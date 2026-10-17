import { describe, expect, it } from 'vitest';
import {
  type GameState,
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
  catchGolden,
  comboMult,
  goldenReward,
  recordCombo,
} from './economy';
import { ACHIEVEMENTS, achievementMult, unlockAchievements } from './achievements';
import { BRAINROTS, customerPool, meet, pickCustomer } from './brainrots';
import { bulkAmount, bulkCost, buyN, canBuyN, maxAffordable } from './economy';
import { UPGRADE_BY_ID } from './upgrades';
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
    let s: GameState = { ...newGame(0), levels: { cashier: 1 } };
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
    expect(formatNumber(0.2, 'ru')).toBe('0,2');
    expect(formatNumber(12.75, 'en')).toBe('12.7');
    expect(formatNumber(1234, 'ru')).toBe('1,23 тыс.');
    expect(formatNumber(2_500_000, 'en')).toBe('2.5M');
    expect(formatNumber(1e12, 'ru')).toBe('1 трлн');
    expect(formatNumber(100_000, 'en')).toBe('100K');
    expect(formatNumber(250_000_000, 'ru')).toBe('250 млн');
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

  it('комбо даёт от ×1 до ×2 к тапу', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(25)).toBe(1.5);
    expect(comboMult(500)).toBe(2);
    expect(tap(newGame(0), 0, comboMult(50)).money).toBe(2);
  });

  it('лучшая серия запоминается', () => {
    const s = recordCombo(recordCombo(newGame(0), 30), 10);
    expect(s.bestCombo).toBe(30);
  });

  it('щедрый гость приносит деньги и считается', () => {
    const s = catchGolden(newGame(0), 0);
    expect(s.money).toBe(goldenReward(newGame(0), 0));
    expect(s.goldenCaught).toBe(1);
  });

  it('достижения выдаются один раз и увеличивают доход', () => {
    let s: GameState = { ...newGame(0), taps: 100, levels: { cashier: 1 } };
    const before = incomePerSecond(s, 0);
    const r = unlockAchievements(s);
    expect(r.unlocked).toEqual(['taps_100']);
    s = r.state;
    expect(unlockAchievements(s).unlocked).toEqual([]);
    expect(achievementMult(s)).toBeCloseTo(1.03);
    expect(incomePerSecond(s, 0)).toBeCloseTo(before * 1.03);
  });

  it('у всех достижений разные id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('старое сохранение получает пустые достижения', () => {
    const s = normalize({ version: 2, money: 5, achievements: ['taps_100', 7] }, 0);
    expect(s.achievements).toEqual(['taps_100']);
    expect(normalize({ money: 1 }, 0).achievements).toEqual([]);
  });

  it('пачка из 10 стоит как 10 покупок подряд', () => {
    const def = UPGRADE_BY_ID.knife;
    let one: GameState = { ...newGame(0), money: 1e6 };
    for (let i = 0; i < 10; i++) one = buy(one, 'knife');
    const ten = buyN({ ...newGame(0), money: 1e6 }, 'knife', 10);
    expect(ten.levels.knife).toBe(10);
    expect(ten.money).toBeCloseTo(one.money);
    expect(bulkCost(newGame(0), def, 1)).toBe(10);
  });

  it('пачку нельзя купить без денег, а максимум считает доступное', () => {
    const def = UPGRADE_BY_ID.knife;
    const s: GameState = { ...newGame(0), money: 25 };
    expect(canBuyN(s, 'knife', 10)).toBe(false);
    expect(maxAffordable(s, def)).toBe(2); // 10 + 12 = 22
    expect(bulkAmount(s, def, 'max')).toBe(2);
    expect(bulkAmount(newGame(0), def, 'max')).toBe(1);
  });

  it('множитель нельзя купить пачкой дважды', () => {
    const def = UPGRADE_BY_ID.sign;
    expect(bulkAmount({ ...newGame(0), money: 1e9 }, def, 'x10')).toBe(1);
    expect(maxAffordable({ ...newGame(0), money: 1e9 }, def)).toBe(1);
  });

  it('на каждой локации свои брейнроты, старые тоже заходят', () => {
    const ids = (l: number) => customerPool(l).map((p) => p.id);
    expect(ids(0)).toContain('tralalero');
    expect(ids(0)).not.toContain('vaca');
    expect(ids(4)).toContain('vaca');
    expect(ids(4)).toContain('tralalero');
    for (let l = 0; l < LOCATIONS.length; l++) expect(ids(l).length).toBeGreaterThan(0);
    expect(ids(0)).toContain(pickCustomer(0, 0.999));
  });

  it('знакомство с брейнротом записывается один раз', () => {
    let s = meet(newGame(0), 'tralalero');
    s = meet(s, 'tralalero');
    s = meet(s, 'unknown');
    expect(s.met).toEqual(['tralalero']);
    expect(new Set(BRAINROTS.map((b) => b.id)).size).toBe(BRAINROTS.length);
    expect(normalize({ met: ['tralalero', 3] }, 0).met).toEqual(['tralalero']);
    expect(normalize({}, 0).musicOff).toBe(false);
    expect(normalize({ musicOff: true }, 0).musicOff).toBe(true);
  });
});

describe('внешний вид ларька', () => {
  it('первый уровень любого улучшения меняет ларёк', async () => {
    const { lookOf, lookKey } = await import('./look');
    const { UPGRADES } = await import('./upgrades');
    const base = lookKey(lookOf({}));
    for (const u of UPGRADES) expect(lookKey(lookOf({ [u.id]: 1 }))).not.toBe(base);
  });
  it('стадии и украшения растут по порогам', async () => {
    const { stage, tier } = await import('./look');
    expect([0, 1, 9, 10, 25, 50, 100, 400].map(stage)).toEqual([0, 1, 1, 2, 3, 4, 5, 5]);
    expect(tier({ knife: 9 })).toBe(0);
    expect(tier({ knife: 10 })).toBe(1);
    expect(tier({ knife: 150, grill_helper: 50 })).toBe(5);
  });
});
