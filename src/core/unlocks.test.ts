import { describe, expect, it } from 'vitest';
import { newGame, normalize, nextMove, FEATURES, type GameState } from './economy';
import { checkUnlocks, isUnlocked, shouldUnlock } from './unlocks';

const T = 1_700_000_000_000;

describe('обучение по шагам (2.21)', () => {
  it('новичок видит только улицу и улучшения', () => {
    const s = newGame(T);
    expect(s.unlocked).toEqual([]);
    expect(checkUnlocks(s, T).fresh).toEqual([]);
  });

  it('брейнроты открываются после первого помощника, задания — после первого ящика', () => {
    let s: GameState = { ...newGame(T), levels: { grill_helper: 1 }, bought: 3 };
    let r = checkUnlocks(s, T);
    expect(r.fresh).toEqual(['pets']);
    s = { ...r.state, boxesOpened: 1, bought: 8 };
    r = checkUnlocks(s, T);
    expect(r.fresh).toEqual(['quests']);
    expect(isUnlocked(r.state, 'pets')).toBe(true);
    // повторная проверка ничего не открывает заново
    expect(checkUnlocks(r.state, T).fresh).toEqual([]);
  });

  it('подарок дня открывается через 5 минут вместе с первым подарком', () => {
    const s = newGame(T);
    expect(shouldUnlock(s, 'daily', T + 60_000)).toBe(false);
    expect(shouldUnlock(s, 'daily', s.dailyFrom)).toBe(true);
  });

  it('переезд и магазин открываются по доле пути до следующей точки', () => {
    const s = newGame(T);
    const th = nextMove(s).threshold;
    expect(shouldUnlock({ ...s, runEarned: th * 0.04 }, 'move', T)).toBe(false);
    expect(shouldUnlock({ ...s, runEarned: th * 0.05 }, 'move', T)).toBe(true);
    expect(shouldUnlock({ ...s, runEarned: th * 0.2 }, 'shop', T)).toBe(false);
    expect(shouldUnlock({ ...s, runEarned: th * 0.25 }, 'shop', T)).toBe(true);
  });

  it('после переезда открыто всё', () => {
    const s = { ...newGame(T), location: 1 };
    expect(checkUnlocks(s, T).fresh).toEqual([...FEATURES]);
  });

  it('старое сохранение, где уже играли, получает всё сразу, а новое — ничего', () => {
    expect(normalize({ version: 8, lifetimeEarned: 500 }, T).unlocked).toEqual([...FEATURES]);
    expect(normalize({ version: 8, lifetimeEarned: 0 }, T).unlocked).toEqual([]);
    expect(normalize({ version: 8, unlocked: ['pets', 'nope', 3] }, T).unlocked).toEqual(['pets']);
  });
});
