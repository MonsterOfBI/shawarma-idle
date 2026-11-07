import { describe, expect, it } from 'vitest';
import { type GameState, incomePerSecond, newGame, normalize, tapValue } from './economy';
import { GOAL_BOX_EVERY, checkGoal, goalDone, goalProgress, goalsOn, niceAmount, pickGoal } from './goals';

const T = 1_700_000_000_000;
const played = (over: Partial<GameState> = {}): GameState => ({ ...newGame(T), bought: 2, levels: { knife: 1, grill_helper: 1 }, taps: 5, ...over });

describe('«Следующая цель» (2.21)', () => {
  it('новичку цели не показываются, пока его ведёт подсказка', () => {
    const s = newGame(T);
    expect(goalsOn(s)).toBe(false);
    expect(checkGoal(s, T).state.goal).toBeNull();
    expect(goalsOn(played())).toBe(true);
  });

  it('цель — ближайшая доступная покупка или «заработай»', () => {
    const g = pickGoal(played({ money: 1e9 }), T);
    expect(['buy', 'level']).toContain(g.kind);
    const poor = pickGoal(played({ money: 0 }), T);
    expect(['buy', 'level', 'earn']).toContain(poor.kind);
    if (poor.kind === 'earn') expect(poor.target).toBeGreaterThan(0);
  });

  it('разогреть гриль просим один раз, пока «Жаркой смены» ещё не было', () => {
    expect(pickGoal(played({ taps: 30 }), T).kind).toBe('hot');
    expect(pickGoal(played({ taps: 30, hotUntil: T - 1 }), T).kind).not.toBe('hot');
  });

  it('первый ящик — цель, как только вкладка с брейнротами открыта', () => {
    expect(pickGoal(played({ unlocked: ['pets'] }), T).kind).toBe('box');
    expect(pickGoal(played({ unlocked: ['pets'], boxesOpened: 1 }), T).kind).not.toBe('box');
  });

  it('выполнил — чаевые и сразу новая цель, каждая пятая с ящиком', () => {
    let s = checkGoal(played({ money: 1e9 }), T).state;
    const g = s.goal!;
    expect(g.id).toBeDefined();
    s = { ...s, levels: { ...s.levels, [g.id!]: g.target } };
    expect(goalDone(s, g)).toBe(true);
    const r = checkGoal(s, T);
    expect(r.done?.money).toBeGreaterThan(0);
    expect(r.state.money).toBe(s.money + r.done!.money);
    expect(r.state.runEarned).toBe(s.runEarned); // чаевые не приближают переезд
    expect(r.state.goalsDone).toBe(1);
    expect(r.done?.box).toBe(false);
    expect(r.state.goal).not.toBe(g);
    expect(checkGoal({ ...s, goalsDone: GOAL_BOX_EVERY - 1 }, T).done?.box).toBe(false); // на помойке без ящика
    const far = { ...s, location: 1, goal: { ...g, at: 1000 }, goalsDone: GOAL_BOX_EVERY - 1 };
    expect(checkGoal(far, T).done?.box).toBe(true);
  });

  it('чаевые — около 20 секунд дохода, без планки в 100 ₽ на помойке', () => {
    const s = played({ goal: { kind: 'earn', target: 10, start: 0, at: 0 }, runEarned: 10 });
    const r = checkGoal(s, T);
    const per = incomePerSecond(s, T, false) + tapValue(s, T) * 3;
    expect(r.done!.money).toBe(Math.round(per * 20));
    const bare = { ...newGame(T), bought: 2, goal: { kind: 'earn' as const, target: 1, start: 0, at: 0 }, runEarned: 1 };
    expect(checkGoal(bare, T).done!.money).toBeLessThan(100);
  });

  it('после переезда старая цель заменяется без награды', () => {
    const s = played({ goal: { kind: 'buy', id: 'knife', target: 1, start: 0, at: 0 }, location: 1, levels: {} });
    const r = checkGoal(s, T);
    expect(r.done).toBeUndefined();
    expect(r.state.goal?.at).toBe(1000);
  });

  it('полоска растёт с деньгами и не доходит до конца раньше времени', () => {
    const s = played({ money: 0 });
    const g = { kind: 'earn' as const, target: 200, start: 100, at: 0 };
    expect(goalProgress({ ...s, runEarned: 150 }, g)).toBeCloseTo(0.5);
    expect(goalProgress({ ...s, runEarned: 199 }, g)).toBeLessThan(1);
    expect(goalProgress({ ...s, runEarned: 200 }, g)).toBe(1);
  });

  it('круглые суммы: 1, 2, 5 со степенью десяти', () => {
    expect(niceAmount(3)).toBe(10);
    expect(niceAmount(130)).toBe(200);
    expect(niceAmount(4200)).toBe(5000);
    expect(niceAmount(6000)).toBe(10000);
  });

  it('старое сохранение без цели и битая цель — без ошибок', () => {
    expect(normalize({ version: 9, money: 5 }, T).goal).toBeNull();
    expect(normalize({ version: 9, goal: { kind: 'x', target: 1 } }, T).goal).toBeNull();
    expect(normalize({ version: 9, goal: { kind: 'buy', id: 'nope', target: 1, start: 0, at: 0 } }, T).goal).toBeNull();
    const g = { kind: 'buy', id: 'knife', target: 1, start: 0, at: 0 };
    expect(normalize({ version: 9, goal: g, goalsDone: 3 }, T)).toMatchObject({ goal: g, goalsDone: 3 });
  });
});
