// Чистая логика экономики: без Phaser и без браузера, чтобы её можно было тестировать.

import { LOCATIONS } from './locations';
import { UPGRADES, UPGRADE_BY_ID, type UpgradeDef, upgradeCost } from './upgrades';

export const SAVE_VERSION = 2;

// Офлайн-доход начисляется не больше чем за 2 часа отсутствия.
export const OFFLINE_CAP_SECONDS = 2 * 60 * 60;
// Буст ×2 за рекламу: 10 минут за просмотр, копится до часа.
export const BOOST_SECONDS = 10 * 60;
export const BOOST_MAX_SECONDS = 60 * 60;

export interface GameState {
  version: number;
  money: number;
  runEarned: number; // заработано на текущей локации, нужно для переезда
  lifetimeEarned: number;
  taps: number;
  levels: Record<string, number>;
  location: number; // индекс в LOCATIONS
  boostUntil: number; // мс; до этого момента доход ×2
  owned: { noAds: boolean; x2Forever: boolean };
  muted: boolean;
  lastSeen: number; // мс, Date.now()
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
    boostUntil: 0,
    owned: { noAds: false, x2Forever: false },
    muted: false,
    lastSeen: now,
  };
}

// Приводит любое сохранение (в том числе старое или битое) к текущему формату.
export function normalize(raw: unknown, now: number): GameState {
  const base = newGame(now);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, any>;
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const levels: Record<string, number> = {};
  if (r.levels && typeof r.levels === 'object') {
    for (const [k, v] of Object.entries(r.levels)) {
      // версия 1: recipe → knife, helper → grill_helper
      const id = k === 'recipe' ? 'knife' : k === 'helper' ? 'grill_helper' : k;
      if (UPGRADE_BY_ID[id]) levels[id] = Math.floor(num(v, 0));
    }
  }
  return {
    version: SAVE_VERSION,
    money: num(r.money, 0),
    runEarned: num(r.runEarned, num(r.money, 0)),
    lifetimeEarned: num(r.lifetimeEarned, num(r.money, 0)),
    taps: num(r.taps, 0),
    levels,
    location: Math.min(Math.floor(num(r.location, 0)), LOCATIONS.length - 1),
    boostUntil: num(r.boostUntil, 0),
    owned: { noAds: !!r.owned?.noAds, x2Forever: !!r.owned?.x2Forever },
    muted: !!r.muted,
    lastSeen: num(r.lastSeen, now),
  };
}

export function level(state: GameState, id: string): number {
  return state.levels[id] ?? 0;
}

export function boostActive(state: GameState, now: number): boolean {
  return state.boostUntil > now;
}

function multFor(state: GameState, now: number, includeBoost: boolean, target: 'all' | 'tap'): number {
  let m = LOCATIONS[state.location].mult;
  if (state.owned.x2Forever) m *= 2;
  if (includeBoost && boostActive(state, now)) m *= 2;
  for (const u of UPGRADES) {
    if (u.kind !== 'mult' || level(state, u.id) === 0) continue;
    if (u.target === 'all' || u.target === target) m *= Math.pow(u.amount, level(state, u.id));
  }
  return m;
}

export function tapValue(state: GameState, now: number): number {
  let base = 1;
  for (const u of UPGRADES) if (u.kind === 'tap') base += u.amount * level(state, u.id);
  return base * multFor(state, now, true, 'tap');
}

export function incomePerSecond(state: GameState, now: number, includeBoost = true): number {
  let base = 0;
  for (const u of UPGRADES) if (u.kind === 'helper') base += u.amount * level(state, u.id);
  return base * multFor(state, now, includeBoost, 'all');
}

export function costOf(state: GameState, def: UpgradeDef): number {
  return upgradeCost(def, level(state, def.id));
}

export function isMaxed(state: GameState, def: UpgradeDef): boolean {
  return def.maxLevel !== undefined && level(state, def.id) >= def.maxLevel;
}

export function canBuy(state: GameState, id: string): boolean {
  const def = UPGRADE_BY_ID[id];
  return !!def && !isMaxed(state, def) && state.money >= costOf(state, def);
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

export function tap(state: GameState, now: number): GameState {
  return { ...earn(state, tapValue(state, now)), taps: state.taps + 1 };
}

export function buy(state: GameState, id: string): GameState {
  if (!canBuy(state, id)) return state;
  const def = UPGRADE_BY_ID[id];
  return {
    ...state,
    money: state.money - costOf(state, def),
    levels: { ...state.levels, [id]: level(state, id) + 1 },
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

export function nextLocation(state: GameState) {
  return LOCATIONS[state.location + 1];
}

export function canRelocate(state: GameState): boolean {
  const next = nextLocation(state);
  return !!next && state.runEarned >= next.threshold;
}

// Переезд: деньги и улучшения сгорают, локация даёт постоянный множитель.
export function relocate(state: GameState, now: number): GameState {
  if (!canRelocate(state)) return state;
  return {
    ...state,
    money: 0,
    runEarned: 0,
    levels: {},
    location: state.location + 1,
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
