// Чистая логика экономики: без Phaser и без браузера, чтобы её можно было тестировать.

import { achievementMult } from './achievements';
import { LOCATIONS, LOCATION_FROM_V7 } from './locations';
import { payOf } from './brainrots';
import { type BoxKind, type Pet, MAX_STARS, openBox, petMult } from './pets';
import { UPGRADES, UPGRADE_BY_ID, type UpgradeDef, upgradeCost } from './upgrades';

export const SAVE_VERSION = 8;

// Офлайн-доход начисляется не больше чем за 4 часа отсутствия
// (игроки Яндекс Игр заходят 2–3 раза в день, за 2 часа они теряли бо́льшую часть дохода).
export const OFFLINE_CAP_SECONDS = 4 * 60 * 60;
// После дворца путь не кончается: каждая «звезда дворца» — новый переезд в расширенный дворец.
// Порог растёт в 4 раза за звезду, доход — в 3 раза, поэтому каждая следующая звезда чуть дольше.
export const STAR_MULT = 3;
export const STAR_THRESHOLD_GROWTH = 4;
// Буст ×2 за рекламу: 10 минут за просмотр, копится до часа.
export const BOOST_SECONDS = 10 * 60;
export const BOOST_MAX_SECONDS = 60 * 60;
// Комбо: тапы чаще чем раз в 0,7 с копят серию, серия до 50 даёт до ×2 к тапу.
export const COMBO_WINDOW_MS = 700;
export const COMBO_MAX = 50;
// Критический тап: с шансом 6 % тап приносит в 10 раз больше.
export const CRIT_CHANCE = 0.06;
export const CRIT_MULT = 10;
export function isCrit(r: number): boolean {
  return r < CRIT_CHANCE;
}
// Час пик: тапы ×3 на 30 секунд.
export const RUSH_MULT = 3;
export const RUSH_SECONDS = 30;
// Вехи как в AdVenture Capitalist: на этих уровнях улучшение начинает приносить вдвое больше.
export const MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];
// Эффекты Бомбардиро: «Лихорадка» — доход в секунду ×7 на 30 с, «Бешеные тапы» — тапы ×10 на 15 с.
export const FRENZY_MULT = 7;
export const FRENZY_SECONDS = 30;
export const TAP_FRENZY_MULT = 10;
export const TAP_FRENZY_SECONDS = 15;
// Бесплатный золотой ящик за рекламу — не чаще раза в 4 минуты (вернули в версии 2.12).
export const AD_BOX_COOLDOWN_MS = 4 * 60 * 1000;

export interface GameState {
  version: number;
  money: number;
  runEarned: number; // заработано на текущей локации, нужно для переезда
  lifetimeEarned: number;
  taps: number;
  levels: Record<string, number>;
  location: number; // индекс в LOCATIONS
  stars: number; // звёзды дворца: сколько раз расширяли дворец после конца сюжета
  boostUntil: number; // мс; до этого момента доход ×2
  owned: { noAds: boolean; x2Forever: boolean };
  muted: boolean;
  musicOff: boolean; // музыка выключена отдельно от звуков
  lastSeen: number; // мс, Date.now()
  achievements: string[]; // id полученных достижений, не сгорают при переезде
  goldenCaught: number; // сколько щедрых гостей поймано
  bestCombo: number; // лучшая серия тапов
  met: string[]; // знакомые брейнроты для коллекции
  pets: Record<string, Pet>; // брейнроты из ящиков, не сгорают при переезде
  boxesOpened: number;
  bought: number; // сколько уровней улучшений куплено за всё время (для заданий)
  frenzyUntil: number; // мс; лихорадка дохода от Бомбардиро
  tapFrenzyUntil: number; // мс; бешеные тапы от Бомбардиро
  adBoxAt: number; // мс; когда снова можно взять ящик за рекламу
  daily: { streak: number; last: string }; // календарь наград: день серии и дата последней
  quests: Quest[];
  questsDone: number;
  merges: number; // сколько раз сливали брейнротов
  sold: number; // продано шаурмы за всё время: тапы плюс обслуженные гости (для лидерборда)
  week: { id: number; sold: number }; // продано за текущую неделю (номер недели по Москве)
  runStart: number; // мс; когда начался путь на текущей точке (для рекорда скорости переезда)
  moveBest: Record<string, number>; // лучшее время каждого переезда в мс, ключ — moveKey
}

export type QuestKind = 'taps' | 'buy' | 'golden' | 'box' | 'earn' | 'combo';
export interface Quest {
  kind: QuestKind;
  target: number;
  start: number; // значение счётчика в момент выдачи
  reward: { minutes?: number; box?: BoxKind };
}

export function newGame(now: number): GameState {
  return {
    version: SAVE_VERSION,
    money: 0,
    runEarned: 0,
    lifetimeEarned: 0,
    taps: 0,
    levels: {},
    location: 0,
    stars: 0,
    boostUntil: 0,
    owned: { noAds: false, x2Forever: false },
    muted: false,
    musicOff: false,
    lastSeen: now,
    achievements: [],
    goldenCaught: 0,
    bestCombo: 0,
    met: [],
    pets: {},
    boxesOpened: 0,
    bought: 0,
    frenzyUntil: 0,
    tapFrenzyUntil: 0,
    adBoxAt: 0,
    daily: { streak: 0, last: '' },
    quests: [],
    questsDone: 0,
    merges: 0,
    runStart: now,
    moveBest: {},
    sold: 0,
    week: { id: weekId(now), sold: 0 },
  };
}

// Приводит любое сохранение (в том числе старое или битое) к текущему формату.
export function normalize(raw: unknown, now: number): GameState {
  const base = newGame(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  // версия 7: сюжет начинается с коробки у помойки. Старые сохранения начинают путь заново,
  // но питомцы, достижения, коллекция и покупки остаются.
  const fresh = num(r.version, 0) < 7;
  const levels: Record<string, number> = {};
  if (!fresh && r.levels && typeof r.levels === 'object') {
    for (const [k, v] of Object.entries(r.levels)) {
      // версия 1: recipe → knife, helper → grill_helper
      const id = k === 'recipe' ? 'knife' : k === 'helper' ? 'grill_helper' : k;
      if (UPGRADE_BY_ID[id]) levels[id] = Math.floor(num(v, 0));
    }
  }
  return {
    version: SAVE_VERSION,
    money: fresh ? 0 : num(r.money, 0),
    runEarned: fresh ? 0 : num(r.runEarned, num(r.money, 0)),
    lifetimeEarned: num(r.lifetimeEarned, num(r.money, 0)),
    taps: num(r.taps, 0),
    levels,
    location: fresh ? 0 : migrateLocation(num(r.version, 0), Math.floor(num(r.location, 0))),
    stars: fresh ? 0 : Math.floor(num(r.stars, 0)),
    boostUntil: num(r.boostUntil, 0),
    owned: { noAds: !!r.owned?.noAds, x2Forever: !!r.owned?.x2Forever },
    muted: !!r.muted,
    musicOff: !!r.musicOff,
    lastSeen: num(r.lastSeen, now),
    achievements: Array.isArray(r.achievements) ? r.achievements.filter((a: unknown) => typeof a === 'string') : [],
    goldenCaught: Math.floor(num(r.goldenCaught, 0)),
    bestCombo: Math.floor(num(r.bestCombo, 0)),
    met: Array.isArray(r.met) ? r.met.filter((a: unknown) => typeof a === 'string') : [],
    pets: normalizePets(r.pets),
    boxesOpened: Math.floor(num(r.boxesOpened, 0)),
    bought: Math.floor(num(r.bought, 0)),
    frenzyUntil: num(r.frenzyUntil, 0),
    tapFrenzyUntil: num(r.tapFrenzyUntil, 0),
    adBoxAt: num(r.adBoxAt, 0),
    daily: {
      streak: Math.min(7, Math.floor(num(r.daily?.streak, 0))),
      last: typeof r.daily?.last === 'string' ? r.daily.last : '',
    },
    quests: Array.isArray(r.quests) ? r.quests.filter(validQuest) : [],
    questsDone: Math.floor(num(r.questsDone, 0)),
    merges: Math.floor(num(r.merges, 0)),
    // до версии 2.9 продажи не считали: начинаем с числа тапов
    sold: Math.floor(num(r.sold, num(r.taps, 0))),
    week: {
      id: Math.floor(num(r.week?.id, weekId(now))),
      sold: Math.floor(num(r.week?.sold, 0)),
    },
    runStart: fresh ? now : num(r.runStart, now),
    moveBest:
      r.moveBest && typeof r.moveBest === 'object'
        ? Object.fromEntries(Object.entries(r.moveBest).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v > 0)) as Record<string, number>
        : {},
  };
}

// Версия 8: в сюжете пять точек вместо семи, номер точки из версии 7 переводится на новую карту.
function migrateLocation(version: number, loc: number): number {
  const mapped = version < 8 ? (LOCATION_FROM_V7[loc] ?? LOCATIONS.length - 1) : loc;
  return Math.min(Math.max(0, mapped), LOCATIONS.length - 1);
}

function normalizePets(raw: unknown): Record<string, Pet> {
  const out: Record<string, Pet> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, any>)) {
    const count = Math.floor(Number(v?.count));
    if (count >= 1)
      out[id] = {
        count,
        mut: Math.min(2, Math.max(0, Math.floor(Number(v?.mut) || 0))),
        stars: Math.min(MAX_STARS, Math.max(0, Math.floor(Number(v?.stars) || 0))),
      };
  }
  return out;
}

function validQuest(q: any): q is Quest {
  return !!q && ['taps', 'buy', 'golden', 'box', 'earn', 'combo'].includes(q.kind) && q.target > 0 && typeof q.start === 'number' && !!q.reward;
}

export function level(state: GameState, id: string): number {
  return state.levels[id] ?? 0;
}

export function boostActive(state: GameState, now: number): boolean {
  return state.boostUntil > now;
}

function multFor(state: GameState, now: number, includeBoost: boolean, target: 'all' | 'tap'): number {
  let m = locationMult(state) * achievementMult(state) * petMult(state);
  if (state.owned.x2Forever) m *= 2;
  if (includeBoost && boostActive(state, now)) m *= 2;
  for (const u of UPGRADES) {
    if (u.kind !== 'mult' || level(state, u.id) === 0) continue;
    if (u.target === 'all' || u.target === target) m *= Math.pow(u.amount, level(state, u.id));
  }
  return m;
}

// Сколько вех пройдено и во сколько раз они умножают отдачу улучшения.
export function milestonesReached(lv: number): number {
  return MILESTONES.filter((m) => lv >= m).length;
}
export function milestoneMult(lv: number): number {
  return Math.pow(2, milestonesReached(lv));
}
export function nextMilestone(lv: number): number | undefined {
  return MILESTONES.find((m) => lv < m);
}

function output(u: UpgradeDef, lv: number): number {
  return u.amount * lv * milestoneMult(lv);
}


export function tapValue(state: GameState, now: number): number {
  let base = 1;
  for (const u of UPGRADES) if (u.kind === 'tap') base += output(u, level(state, u.id));
  let m = multFor(state, now, true, 'tap');
  if (now < state.tapFrenzyUntil) m *= TAP_FRENZY_MULT;
  return base * m;
}

export function incomePerSecond(state: GameState, now: number, includeBoost = true): number {
  let base = 0;
  for (const u of UPGRADES) if (u.kind === 'helper') base += output(u, level(state, u.id));
  let m = multFor(state, now, includeBoost, 'all');
  if (includeBoost && now < state.frenzyUntil) m *= FRENZY_MULT;
  return base * m;
}

// Наценка на улучшения по точкам (версия 2.11). Работает как урезанный вдвое доход,
// но тап по-прежнему стоит целый 1 ₽. На помойке наценка меньше, чтобы новичок быстрее переехал.
export const PRICE_MULT = [1.5, 2, 2, 2, 2];
export function priceAt(state: GameState, def: UpgradeDef, lvl: number): number {
  return Math.ceil(upgradeCost(def, lvl) * (PRICE_MULT[state.location] ?? 2));
}

export function costOf(state: GameState, def: UpgradeDef): number {
  return priceAt(state, def, level(state, def.id));
}

export function isMaxed(state: GameState, def: UpgradeDef): boolean {
  return def.maxLevel !== undefined && level(state, def.id) >= def.maxLevel;
}

export function canBuy(state: GameState, id: string): boolean {
  const def = UPGRADE_BY_ID[id];
  return !!def && !isMaxed(state, def) && state.money >= costOf(state, def);
}

// Покупка пачкой: ×1, ×10 или сколько хватит денег.
export type BuyMode = 'x1' | 'x10' | 'max';
const BULK_LIMIT = 1000;

// Сколько стоят n уровней подряд начиная с текущего.
export function bulkCost(state: GameState, def: UpgradeDef, n: number): number {
  let sum = 0;
  const from = level(state, def.id);
  for (let i = 0; i < n; i++) sum += priceAt(state, def, from + i);
  return sum;
}

// Сколько уровней игрок может купить прямо сейчас.
export function maxAffordable(state: GameState, def: UpgradeDef): number {
  const from = level(state, def.id);
  const cap = def.maxLevel !== undefined ? Math.max(0, def.maxLevel - from) : BULK_LIMIT;
  let n = 0;
  let sum = 0;
  while (n < cap) {
    const next = sum + priceAt(state, def, from + n);
    if (next > state.money) break;
    sum = next;
    n++;
  }
  return n;
}

// Сколько уровней купит кнопка в этом режиме (для показа цены даже без денег).
export function bulkAmount(state: GameState, def: UpgradeDef, mode: BuyMode): number {
  const left = def.maxLevel !== undefined ? def.maxLevel - level(state, def.id) : BULK_LIMIT;
  if (left <= 0) return 0;
  if (mode === 'max') return Math.max(1, Math.min(left, maxAffordable(state, def)));
  return Math.min(left, mode === 'x10' ? 10 : 1);
}

export function canBuyN(state: GameState, id: string, n: number): boolean {
  const def = UPGRADE_BY_ID[id];
  return !!def && n >= 1 && !isMaxed(state, def) && state.money >= bulkCost(state, def, n);
}

export function buyN(state: GameState, id: string, n: number): GameState {
  if (!canBuyN(state, id, n)) return state;
  const def = UPGRADE_BY_ID[id];
  return {
    ...state,
    money: state.money - bulkCost(state, def, n),
    levels: { ...state.levels, [id]: level(state, id) + n },
    bought: state.bought + n,
  };
}

// Улучшение видно, когда игрок заработал хотя бы треть его цены (или уже купил его).
export function isVisible(state: GameState, def: UpgradeDef): boolean {
  return level(state, def.id) > 0 || state.runEarned >= def.baseCost / 3 || def.baseCost <= 15;
}

function earn(state: GameState, amount: number): GameState {
  return {
    ...state,
    money: state.money + amount,
    runEarned: state.runEarned + amount,
    lifetimeEarned: state.lifetimeEarned + amount,
  };
}

// extra — множитель комбо и часа пика, считается в контроллере
export function tap(state: GameState, now: number, extra = 1): GameState {
  return sell({ ...earn(state, tapValue(state, now) * extra), taps: state.taps + 1 }, now);
}

// ---------- продажи для лидерборда ----------
// Неделя начинается в понедельник в 00:00 по Москве (UTC+3), у всех игроков одна и та же.
const WEEK_MS = 7 * 86_400_000;
const WEEK_ZERO = Date.UTC(2026, 0, 4, 21); // понедельник 5 января 2026, 00:00 МСК
export function weekId(now: number): number {
  return Math.floor((now - WEEK_ZERO) / WEEK_MS);
}
export function weekEndsAt(now: number): number {
  return WEEK_ZERO + (weekId(now) + 1) * WEEK_MS;
}
// Продана одна шаурма: счёт за всё время и за неделю (новая неделя начинает счёт с нуля).
export function sell(state: GameState, now: number, n = 1): GameState {
  const id = weekId(now);
  const week = state.week.id === id ? { id, sold: state.week.sold + n } : { id, sold: n };
  return { ...state, sold: state.sold + n, week };
}
// Продажи за неделю, которые видны сейчас: если неделя сменилась, это ноль.
export function soldThisWeek(state: GameState, now: number): number {
  return state.week.id === weekId(now) ? state.week.sold : 0;
}
// Очки недельной таблицы: номер недели × 1 000 000 + продажи (не больше 999 999).
// У Яндекса нет недельного сброса, поэтому неделя зашита в старшие разряды:
// результаты прошлых недель всегда ниже текущих, а игра показывает только текущую неделю.
export const WEEK_SCALE = 1_000_000;
export function weeklyScore(state: GameState, now: number): number {
  return weekId(now) * WEEK_SCALE + Math.min(WEEK_SCALE - 1, soldThisWeek(state, now));
}
export function decodeWeekly(score: number, now: number): number | null {
  return Math.floor(score / WEEK_SCALE) === weekId(now) ? score % WEEK_SCALE : null;
}

export function comboMult(combo: number): number {
  return 1 + Math.min(Math.max(combo, 0), COMBO_MAX) / COMBO_MAX;
}

// Новый рекорд серии показываем на экране, только когда старый рекорд уже был заметным
// (иначе у новичка «рекорд» всплывал бы на каждом тапе первых серий).
export const RECORD_SHOW_FROM = 10;
export function beatsRecord(state: GameState, combo: number): boolean {
  return combo > state.bestCombo && state.bestCombo >= RECORD_SHOW_FROM;
}

export function recordCombo(state: GameState, combo: number): GameState {
  return combo > state.bestCombo ? { ...state, bestCombo: combo } : state;
}

// ---------- чеки гостей ----------
// Каждый обслуженный гость платит чек: пара секунд дохода плюс пара тапов, умноженные на его множитель
// (у каждого брейнрота свой, см. payOf). Гостей обслуживают сами работники раз в несколько секунд,
// а тапы игрока ускоряют очередь.
export const CHECK_SECONDS = 2;
export const CHECK_TAPS = 2;

export function customerCheck(state: GameState, now: number, id: string): number {
  const per = incomePerSecond(state, now) * CHECK_SECONDS + tapValue({ ...state, tapFrenzyUntil: 0 }, now) * CHECK_TAPS;
  return Math.max(1, Math.round(per * payOf(id)));
}

export function serveCustomer(state: GameState, now: number, id: string): GameState {
  return sell(earn(state, customerCheck(state, now, id)), now);
}

// Как часто работники сами обслуживают гостя: от 4,5 секунды в начале до 3 секунд у богатой точки.
export function serveIntervalMs(state: GameState, now: number): number {
  const ips = incomePerSecond(state, now, false);
  return Math.round(Math.min(4500, Math.max(3000, 4500 - 250 * Math.log10(ips + 1))));
}

// Щедрый гость: примерно полторы минуты дохода или 40 тапов, смотря что больше.
export function goldenReward(state: GameState, now: number): number {
  return Math.max(25, Math.round(incomePerSecond(state, now) * 90 + tapValue(state, now) * 40));
}

export function catchGolden(state: GameState, now: number): GameState {
  return { ...earn(state, goldenReward(state, now)), goldenCaught: state.goldenCaught + 1 };
}

// Бомбардиро сбрасывает одно из трёх: мешок денег, лихорадку дохода или бешеные тапы.
export type GoldenEffect = 'bag' | 'frenzy' | 'taps';
export function pickGoldenEffect(r: number): GoldenEffect {
  return r < 0.55 ? 'bag' : r < 0.8 ? 'frenzy' : 'taps';
}
export function applyGolden(state: GameState, now: number, effect: GoldenEffect): GameState {
  if (effect === 'bag') return catchGolden(state, now);
  const s = { ...state, goldenCaught: state.goldenCaught + 1 };
  if (effect === 'frenzy') return { ...s, frenzyUntil: now + FRENZY_SECONDS * 1000 };
  return { ...s, tapFrenzyUntil: now + TAP_FRENZY_SECONDS * 1000 };
}

// Награда «деньгами за N минут»: доход в секунду плюс 3 тапа в секунду, не меньше 100 ₽.
export function minutesOfIncome(state: GameState, now: number, minutes: number): number {
  const per = incomePerSecond(state, now, false) + tapValue({ ...state, tapFrenzyUntil: 0 }, now) * 3;
  return Math.max(100 * (state.location + 1), Math.round(per * 60 * minutes));
}

// ---------- ящики с брейнротами ----------

// Обычный ящик стоит примерно 3 минуты дохода (с тапами 3 раза в секунду)
// и дорожает на 3 % с каждым открытым ящиком (версия 2.12; в 2.11 было 2 минуты и +2 %, до этого 6 минут и +4 %).
export const BOX_MINUTES = 3;
export const BOX_GROWTH = 0.03;
export function boxCost(state: GameState, now: number): number {
  return Math.round(minutesOfIncome(state, now, BOX_MINUTES) * (1 + state.boxesOpened * BOX_GROWTH));
}

export function canBuyBox(state: GameState, now: number): boolean {
  return state.money >= boxCost(state, now);
}

export function buyBox(state: GameState, now: number, rand: () => number) {
  if (!canBuyBox(state, now)) return null;
  return openBox({ ...state, money: state.money - boxCost(state, now) }, 'common', rand);
}

export function adBoxReady(state: GameState, now: number): boolean {
  return now >= state.adBoxAt;
}

export function freeBox(state: GameState, now: number, kind: BoxKind, rand: () => number, fromAd = false) {
  const r = openBox(state, kind, rand);
  return fromAd ? { ...r, state: { ...r.state, adBoxAt: now + AD_BOX_COOLDOWN_MS } } : r;
}

export function buy(state: GameState, id: string): GameState {
  if (!canBuy(state, id)) return state;
  const def = UPGRADE_BY_ID[id];
  return {
    ...state,
    money: state.money - costOf(state, def),
    levels: { ...state.levels, [id]: level(state, id) + 1 },
    bought: state.bought + 1,
  };
}

// Доход за прошедшее время в игре (каждый кадр).
export function tick(state: GameState, now: number): GameState {
  const seconds = Math.max(0, (now - state.lastSeen) / 1000);
  return { ...earn(state, incomePerSecond(state, now) * seconds), lastSeen: now };
}

// Сколько игрок заработал, пока игра была закрыта. Без буста, не больше 2 часов.
export function offlineEarnings(state: GameState, now: number): number {
  const seconds = Math.min(Math.max(0, (now - state.lastSeen) / 1000), OFFLINE_CAP_SECONDS);
  return incomePerSecond(state, now, false) * seconds;
}

export function collectOffline(state: GameState, now: number, factor: number): GameState {
  return { ...earn(state, offlineEarnings(state, now) * factor), lastSeen: now };
}

// Множитель точки с учётом звёзд дворца.
export function locationMult(state: GameState): number {
  return LOCATIONS[state.location].mult * Math.pow(STAR_MULT, state.stars);
}

export function nextLocation(state: GameState) {
  return LOCATIONS[state.location + 1];
}

// Куда ведёт следующий переезд: на новую точку сюжета или в следующую звезду дворца.
export interface NextMove {
  id: string;
  star: number; // 0 — обычная точка, 1+ — номер звезды дворца
  threshold: number;
  mult: number;
}

export function nextMove(state: GameState): NextMove {
  const next = nextLocation(state);
  if (next) return { id: next.id, star: 0, threshold: next.threshold, mult: next.mult };
  const last = LOCATIONS[LOCATIONS.length - 1];
  const star = state.stars + 1;
  return { id: last.id, star, threshold: last.threshold * Math.pow(STAR_THRESHOLD_GROWTH, star), mult: last.mult * Math.pow(STAR_MULT, star) };
}

export function canRelocate(state: GameState): boolean {
  return state.runEarned >= nextMove(state).threshold;
}

// ---------- рекорд скорости переезда ----------
// Каждый переезд (на точку или на звезду дворца) засекается отдельно. Побил свой рекорд — золотой ящик.
export function moveKey(state: GameState): string {
  const n = nextMove(state);
  return n.star ? `star${n.star}` : n.id;
}

export function runTime(state: GameState, now: number): number {
  return Math.max(0, now - state.runStart);
}

// Быстрее ли этот переезд прошлого такого же. Первый раз сравнивать не с чем.
export function fastMove(state: GameState, now: number): boolean {
  const best = state.moveBest[moveKey(state)];
  return best !== undefined && runTime(state, now) < best;
}

// Каждый переезд дарит мифический ящик (мифический брейнрот или выше).
export const MOVE_BOX: BoxKind = 'legend';

export function relocate(state: GameState, now: number): GameState {
  if (!canRelocate(state)) return state;
  const atEnd = !nextLocation(state);
  const key = moveKey(state);
  const time = runTime(state, now);
  const best = state.moveBest[key];
  return {
    ...state,
    runStart: now,
    moveBest: { ...state.moveBest, [key]: best === undefined ? time : Math.min(best, time) },
    money: 0,
    runEarned: 0,
    levels: {},
    location: atEnd ? state.location : state.location + 1,
    stars: atEnd ? state.stars + 1 : state.stars,
    lastSeen: now,
  };
}

export function addBoost(state: GameState, now: number): GameState {
  const from = Math.max(state.boostUntil, now);
  const until = Math.min(from + BOOST_SECONDS * 1000, now + BOOST_MAX_SECONDS * 1000);
  return { ...state, boostUntil: until };
}

// Пакет денег из магазина: доход за 30 минут, но не меньше 1 000.
export function cashPackAmount(state: GameState, now: number): number {
  return Math.max(1000, Math.round(incomePerSecond(state, now, false) * 1800 + tapValue(state, now) * 300));
}

export function addMoney(state: GameState, amount: number): GameState {
  return earn(state, amount);
}
