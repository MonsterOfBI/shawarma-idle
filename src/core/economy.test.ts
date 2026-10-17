import { describe, expect, it } from 'vitest';
import {
  OFFLINE_CAP_SECONDS,
  addBoost,
  buy,
  canBuy,
  canRelocate,
  collectOffline,
  incomePerSecond,
  newGame,
  normalize,
  offlineEarnings,
  relocate,
  tap,
  tapValue,
  tick,
} from './economy';
import { formatNumber } from './format';
import { LOCATIONS } from './locations';
import { secondsToEarn } from './sim';
import { UPGRADES, upgradeCost } from './upgrades';

describe('экономика', () => {
  it('тап даёт 1 ₽ в начале игры', () => {
    expect(tap(newGame(0), 0).money).toBe(1);
  });

  it('нож увеличивает доход с тапа', () => {
    const s = buy({ ...newGame(0), money: 100 }, 'knife');
    expect(tapValue(s, 0)).toBe(2);
  });

  it('нельзя купить без денег', () => {
    const s = newGame(0);
    expect(canBuy(s, 'grill_helper')).toBe(false);
    expect(buy(s, 'grill_helper')).toBe(s);
  });

  it('множитель покупается один раз', () => {
    let s = buy({ ...newGame(0), money: 1e9 }, 'sign');
    expect(canBuy(s, 'sign')).toBe(false);
    s = buy(s, 'sign');
    expect(s.levels.sign).toBe(1);
  });

  it('цены растут и остаются конечными', () => {
    for (const u of UPGRADES) {
      expect(upgradeCost(u, 1)).toBeGreaterThan(upgradeCost(u, 0));
      expect(Number.isFinite(upgradeCost(u, 500))).toBe(true);
    }
  });

  it('у всех улучшений разные id', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });

  it('помощники приносят доход за прошедшее время', () => {
    const s = { ...newGame(0), levels: { cashier: 3 } };
    expect(tick(s, 10_000).money).toBeCloseTo(30);
  });

  it('буст удваивает доход и копится не больше часа', () => {
    let s = { ...newGame(0), levels: { cashier: 1 } };
    s = addBoost(s, 0);
    expect(incomePerSecond(s, 1000)).toBe(2);
    for (let i = 0; i < 10; i++) s = addBoost(s, 0);
    expect(s.boostUntil).toBe(60 * 60 * 1000);
  });

  it('офлайн-доход ограничен двумя часами и не учитывает буст', () => {
    const s = addBoost({ ...newGame(0), levels: { cashier: 1 } }, 0);
    expect(offlineEarnings(s, 24 * 3600 * 1000)).toBe(OFFLINE_CAP_SECONDS);
    expect(collectOffline(s, 24 * 3600 * 1000, 2).money).toBe(OFFLINE_CAP_SECONDS * 2);
  });

  it('переезд сбрасывает улучшения и даёт множитель', () => {
    const s = { ...newGame(0), money: 5, runEarned: LOCATIONS[1].threshold, levels: { cashier: 1 } };
    expect(canRelocate(s)).toBe(true);
    const r = relocate(s, 0);
    expect(r.location).toBe(1);
    expect(r.money).toBe(0);
    expect(r.levels).toEqual({});
    expect(tapValue(r, 0)).toBe(LOCATIONS[1].mult);
  });

  it('с последней локации переехать нельзя', () => {
    const s = { ...newGame(0), location: LOCATIONS.length - 1, runEarned: 1e30 };
    expect(canRelocate(s)).toBe(false);
  });
});

describe('сохранения', () => {
  it('битое сохранение превращается в новую игру', () => {
    expect(normalize('мусор', 5).money).toBe(0);
    expect(normalize({ money: -3, levels: { nope: 4 } }, 5)).toMatchObject({ money: 0, levels: {} });
  });

  it('сохранение первой версии переносится', () => {
    const s = normalize({ money: 50, levels: { recipe: 2, helper: 1 }, lastSeen: 7 }, 9);
    expect(s.levels).toEqual({ knife: 2, grill_helper: 1 });
    expect(s.money).toBe(50);
    expect(s.lastSeen).toBe(7);
  });
});

describe('числа', () => {
  it('сокращает большие числа', () => {
    expect(formatNumber(999, 'ru')).toBe('999');
    expect(formatNumber(1234, 'ru')).toBe('1,23 тыс.');
    expect(formatNumber(2_500_000, 'en')).toBe('2.5M');
    expect(formatNumber(1e12, 'ru')).toBe('1 трлн');
  });
});

describe('баланс', () => {
  it('первый переезд занимает 6–20 минут активной игры', () => {
    const minutes = secondsToEarn(LOCATIONS[1].threshold, 3) / 60;
    expect(minutes).toBeGreaterThan(6);
    expect(minutes).toBeLessThan(20);
  });

  it('каждый следующий переезд занимает от 5 минут до полутора часов', () => {
    for (let loc = 1; loc < LOCATIONS.length - 1; loc++) {
      const minutes = secondsToEarn(LOCATIONS[loc + 1].threshold, 3, { ...newGame(0), location: loc }) / 60;
      expect(minutes).toBeGreaterThan(5);
      expect(minutes).toBeLessThan(90);
    }
  });
});
