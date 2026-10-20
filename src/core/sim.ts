// Полная симуляция игрока для теста баланса (версия 2.16).
// Раньше тест считал только тапы и улучшения, а живая игра шла в 7 раз быстрее:
// криты, комбо, час пик, Бомбардиро, питомцы, задания, подарки и офлайн тест не видел.
// Теперь игрок здесь делает всё то же, что настоящий: тапает с комбо и критами, ловит Бомбардиро,
// покупает улучшения или ящики (что быстрее окупится), сливает питомцев, выполняет задания,
// забирает подарок дня, переезжает и открывает ящики за переезд. Казуал играет сессиями, между ними офлайн.

import * as E from './economy';
import type { GameState } from './economy';
import { averagePay } from './brainrots';
import { unlockAchievements } from './achievements';
import { UPGRADES } from './upgrades';
import * as PETS from './pets';
import { ensureQuests, claimQuest, questDone } from './quests';
import { claimDaily, dayKey } from './daily';

export interface Profile {
  tps: number; // тапов в секунду
  comboAvg: number; // средний множитель комбо
  catchGolden: number; // доля пойманных Бомбардиро
  adBox: boolean; // берёт золотой ящик за рекламу при каждой возможности
  adBoost: number; // доля времени под бустом ×2 за рекламу
  offlineX2: boolean; // удваивает офлайн за рекламу
  sessions?: { perDay: number; minutes: number }; // играет сессиями, между ними игра закрыта
  maxHours: number; // предел игрового времени
}

export const PROFILES = {
  // активный игрок без рекламы: на нём строится тест баланса
  active: { tps: 3, comboAvg: 1.6, catchGolden: 0.8, adBox: false, adBoost: 0, offlineX2: false, maxHours: 30 },
  ads: { tps: 3, comboAvg: 1.6, catchGolden: 0.8, adBox: true, adBoost: 0.5, offlineX2: true, maxHours: 30 },
  casual: { tps: 2, comboAvg: 1.4, catchGolden: 0.6, adBox: false, adBoost: 0, offlineX2: false, sessions: { perDay: 3, minutes: 20 }, maxHours: 40 },
  casualAds: { tps: 2, comboAvg: 1.4, catchGolden: 0.6, adBox: true, adBoost: 0.3, offlineX2: true, sessions: { perDay: 3, minutes: 20 }, maxHours: 40 },
} satisfies Record<string, Profile>;

export interface Move {
  playMin: number; // минут игры с начала
  day: number; // реальных дней с начала (для казуала)
  pet: number; // множитель питомцев в момент переезда
}
export interface SimResult {
  moves: Move[]; // переезды по сюжету, затем звёзды дворца
  share: Record<string, number>; // доля денег из каждого источника, %
  petMult: number;
}

// Чеки гостей в среднем за секунду.
function checks(s: GameState, now: number) {
  const check = (E.incomePerSecond(s, now) * E.CHECK_SECONDS + E.tapValue({ ...s, tapFrenzyUntil: 0 }, now) * E.CHECK_TAPS) * averagePay(s.location);
  return check / (E.serveIntervalMs(s, now) / 1000);
}
const tapX = (p: Profile) => p.comboAvg * (1 + E.CRIT_CHANCE * (E.CRIT_MULT - 1));
function gain(s: GameState, p: Profile) {
  const calm = { ...s, frenzyUntil: 0, boostUntil: 0, tapFrenzyUntil: 0 };
  return E.incomePerSecond(calm, 0) + E.tapValue(calm, 0) * p.tps * tapX(p) + checks(calm, 0);
}
function bestUpgrade(s: GameState, p: Profile) {
  let id: string | null = null;
  let payback = Infinity;
  const base = gain(s, p);
  for (const u of UPGRADES) {
    if (E.isMaxed(s, u) || !E.isVisible(s, u)) continue;
    const after = gain({ ...s, levels: { ...s.levels, [u.id]: (s.levels[u.id] ?? 0) + 1 } }, p);
    const pb = E.costOf(s, u) / Math.max(after - base, 1e-9);
    if (pb < payback) {
      payback = pb;
      id = u.id;
    }
  }
  return { id, payback };
}
// Ожидаемый прирост множителя питомцев от обычного ящика (грубо: мутации и повторы — небольшой запас).
function boxGain() {
  const o = PETS.BOX_ODDS.common;
  let e = 0;
  for (const r of PETS.RARITIES) e += (o[r] / 100) * PETS.RARITY_BONUS[r];
  return e * 1.14;
}
function mergeAll(s: GameState) {
  for (const id of Object.keys(s.pets)) while (PETS.canMerge(s.pets[id])) s = PETS.mergePet(s, id);
  return s;
}

// Начало симуляции — полдень, чтобы смена дня у казуала приходилась на паузу между сессиями.
const START = new Date(2026, 0, 5, 12).getTime();

export function simulate(p: Profile, palaceStars = 3, seed = 987654321): SimResult {
  let rs = seed;
  const rand = () => (rs = (Math.imul(rs, 1103515245) + 12345) >>> 0) / 4294967296;
  let s: GameState = { ...E.newGame(START), lastSeen: START };
  s = ensureQuests(s, START, rand);
  const src = { taps: 0, passive: 0, checks: 0, golden: 0, quests: 0, daily: 0, offline: 0 };
  const moves: Move[] = [];
  const earn = (k: keyof typeof src, f: () => GameState) => {
    const before = s.lifetimeEarned;
    s = f();
    src[k] += s.lifetimeEarned - before;
  };
  const open = (kind: PETS.BoxKind) => {
    s = mergeAll(PETS.openBox(s, kind, rand).state);
  };
  const goldenEvery = (E.GOLDEN_MIN_MS + E.GOLDEN_SPREAD_MS / 2) / 1000;
  const sessLen = p.sessions ? p.sessions.minutes * 60 : Infinity;
  const gap = p.sessions ? Math.round(86400 / p.sessions.perDay) : 0;
  let t = 0; // реальные секунды с начала
  let play = 0; // секунды игры
  let nextGolden = 35, nextRush = 225, rushUntil = 0, frenzyUntil = 0, tapFrenzyUntil = 0;
  let today = '';
  while (play < p.maxHours * 3600) {
    if (p.sessions && play > 0 && play % sessLen === 0) {
      t += gap - sessLen;
      const now = START + t * 1000;
      earn('offline', () => E.collectOffline(s, now, p.offlineX2 ? 2 : 1));
    }
    const now0 = START + t * 1000;
    const d = dayKey(new Date(now0));
    if (d !== today) {
      const y = dayKey(new Date(now0 - 86400_000));
      today = d;
      const r = claimDaily(s, now0, d, y);
      if (r) {
        src.daily += r.money;
        s = r.state;
        r.boxes.forEach((k) => open(k));
      }
    }
    t++;
    play++;
    const now = START + t * 1000;
    const rush = t < rushUntil ? E.RUSH_MULT : 1;
    earn('taps', () => {
      let x = s;
      for (let i = 0; i < p.tps; i++) x = E.tap(x, now, tapX(p) * rush);
      return x;
    });
    if (t >= nextRush) {
      rushUntil = t + E.RUSH_SECONDS;
      nextRush = t + E.RUSH_SECONDS + 225;
    }
    const boost = p.adBoost > 0 && t % 100 < p.adBoost * 100;
    s = { ...s, boostUntil: boost ? now + 1000 : 0, frenzyUntil: 0, tapFrenzyUntil: 0 };
    earn('passive', () => E.tick({ ...s, lastSeen: now - 1000 }, now));
    earn('checks', () => E.addMoney(s, checks(s, now)));
    if (t >= nextGolden) {
      nextGolden = t + goldenEvery;
      if (rand() < p.catchGolden) {
        const eff = s.goldenCaught === 0 ? 'bag' : E.pickGoldenEffect(rand());
        if (eff === 'bag') earn('golden', () => E.catchGolden(s, now));
        else {
          s = { ...s, goldenCaught: s.goldenCaught + 1 };
          if (eff === 'frenzy') frenzyUntil = t + E.FRENZY_SECONDS;
          else tapFrenzyUntil = t + E.TAP_FRENZY_SECONDS;
        }
      }
    }
    if (t < frenzyUntil) {
      const extra = E.incomePerSecond(s, now) * (E.FRENZY_MULT - 1);
      earn('golden', () => E.addMoney(s, extra));
    }
    if (t < tapFrenzyUntil) {
      const extra = E.tapValue(s, now) * p.tps * tapX(p) * rush * (E.TAP_FRENZY_MULT - 1);
      earn('golden', () => E.addMoney(s, extra));
    }
    s = unlockAchievements(s).state;
    s = ensureQuests(s, now, rand);
    for (let i = 0; i < s.quests.length; i++) {
      if (!questDone(s, s.quests[i])) continue;
      const before = s.lifetimeEarned;
      const r = claimQuest(s, i, now, rand)!;
      s = r.state;
      src.quests += s.lifetimeEarned - before;
      if (r.box) open(r.box);
      i--;
    }
    s = { ...s, bestCombo: Math.max(s.bestCombo, Math.min(60, Math.round(p.comboAvg * 30))) };
    if (p.adBox && E.adBoxReady(s, now)) s = mergeAll(E.freeBox(s, now, 'golden', rand, true).state);
    // покупки: ящик или улучшение — что быстрее окупится
    for (let guard = 0; guard < 300; guard++) {
      const up = bestUpgrade(s, p);
      const c = E.boxCost(s, now);
      const boxPayback = c / Math.max((gain(s, p) * boxGain()) / PETS.petMult(s), 1e-9);
      if (boxPayback < up.payback) {
        if (s.money < c) break;
        open('common');
        s = { ...s, money: s.money - c };
        continue;
      }
      if (up.id && E.canBuy(s, up.id)) {
        s = E.buy(s, up.id);
        continue;
      }
      break;
    }
    if (E.canRelocate(s)) {
      const fast = E.fastMove(s, now);
      s = E.relocate(s, now);
      open(E.MOVE_BOX);
      if (fast) open('golden');
      moves.push({ playMin: Math.round(play / 60), day: +(t / 86400).toFixed(1), pet: +PETS.petMult(s).toFixed(2) });
      if (s.stars >= palaceStars) break;
    }
  }
  const total = Object.values(src).reduce((a, b) => a + b, 0) || 1;
  const share = Object.fromEntries(Object.entries(src).map(([k, v]) => [k, Math.round((v / total) * 100)]));
  return { moves, share, petMult: +PETS.petMult(s).toFixed(2) };
}
