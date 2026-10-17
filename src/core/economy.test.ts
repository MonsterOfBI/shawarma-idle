import { describe, expect, it } from 'vitest';
import { OFFLINE_CAP_SECONDS, buy, canBuy, newGame, tap, tick, upgradeCost } from './economy';

describe('экономика', () => {
  it('тап даёт 1 ₽ в начале игры', () => {
    expect(tap(newGame(0)).money).toBe(1);
  });

  it('рецепт увеличивает доход с тапа', () => {
    let s = { ...newGame(0), money: 100 };
    s = buy(s, 'recipe');
    expect(tap({ ...s, money: 0 }).money).toBe(2);
  });

  it('нельзя купить без денег', () => {
    const s = newGame(0);
    expect(canBuy(s, 'helper')).toBe(false);
    expect(buy(s, 'helper')).toBe(s);
  });

  it('цена растёт с уровнем и остаётся конечной', () => {
    expect(upgradeCost('recipe', 1)).toBeGreaterThan(upgradeCost('recipe', 0));
    expect(Number.isFinite(upgradeCost('helper', 200))).toBe(true);
  });

  it('помощник приносит доход за прошедшее время', () => {
    const s = { ...newGame(0), levels: { recipe: 0, helper: 3 } };
    expect(tick(s, 10_000).earned).toBe(30);
  });

  it('офлайн-доход ограничен двумя часами', () => {
    const s = { ...newGame(0), levels: { recipe: 0, helper: 1 } };
    expect(tick(s, 24 * 60 * 60 * 1000).earned).toBe(OFFLINE_CAP_SECONDS);
  });
});
