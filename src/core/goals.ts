// «Следующая цель» (2.21, после отзыва модерации VK «слабый игровой цикл»).
// Внизу улицы всегда одна короткая цель на 30–90 секунд: купить новое улучшение, дотянуть
// улучшение до вехи ×2, открыть первый ящик, разогреть «Жаркую смену», заработать сумму или переехать.
// Цель выводится из состояния игры; выполнил — чаевые, каждая пятая — ещё и ящик, и сразу следующая.
import {
  type GameState,
  type Goal,
  bulkCost,
  canRelocate,
  incomePerSecond,
  isMaxed,
  isVisible,
  nextMilestone,
  tapValue,
} from './economy';
import { UPGRADES } from './upgrades';

export const GOAL_REWARD_SEC = 20; // чаевые за цель: 20 секунд дохода
export const GOAL_BOX_EVERY = 5; // каждая пятая цель — ещё и обычный ящик (после первого переезда)
const GOAL_REACH_SEC = 150; // цель-покупка, только если на неё хватит примерно за 2,5 минуты
const GOAL_EARN_SEC = 60; // цель «заработай» — примерно минута игры

// Новичка первые шаги ведёт подсказка-палец, цели начинаются после двух покупок.
export function goalsOn(s: GameState): boolean {
  return s.bought >= 2 || s.location > 0 || s.stars > 0;
}

function where(s: GameState) {
  return s.location * 1000 + s.stars;
}

// Сколько денег в секунду у игрока, который не спит и тапает 3 раза в секунду.
function rate(s: GameState, now: number) {
  return incomePerSecond(s, now, false) + tapValue({ ...s, tapFrenzyUntil: 0, hotUntil: 0 }, now) * 3;
}

// Круглая сумма: 1, 2 или 5 со степенью десяти, не меньше 10.
export function niceAmount(x: number): number {
  if (x <= 10) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 5]) if (m * p >= x - 1e-9) return m * p;
  return 10 * p;
}

export function pickGoal(s: GameState, now: number): Goal {
  const at = where(s);
  if (canRelocate(s)) return { kind: 'move', target: 1, start: 0, at };
  if (s.unlocked.includes('pets') && s.boxesOpened === 0) return { kind: 'box', target: 1, start: 0, at };
  if (s.hotUntil === 0 && s.taps >= 20) return { kind: 'hot', target: 1, start: 0, at };
  let best: Goal | null = null;
  let bestCost = Infinity;
  for (const u of UPGRADES) {
    if (!isVisible(s, u) || isMaxed(s, u)) continue;
    const lv = s.levels[u.id] ?? 0;
    const target = lv === 0 || u.kind === 'mult' ? lv + 1 : (nextMilestone(lv) ?? lv + 10);
    const cost = bulkCost(s, u, target - lv);
    if (cost < bestCost) {
      bestCost = cost;
      best = { kind: lv === 0 ? 'buy' : 'level', id: u.id, target, start: lv, at };
    }
  }
  if (best && bestCost <= s.money + rate(s, now) * GOAL_REACH_SEC) return best;
  const amount = niceAmount(rate(s, now) * GOAL_EARN_SEC);
  return { kind: 'earn', target: s.runEarned + amount, start: s.runEarned, at };
}

export function goalDone(s: GameState, g: Goal): boolean {
  switch (g.kind) {
    case 'buy':
    case 'level':
      return (s.levels[g.id ?? ''] ?? 0) >= g.target;
    case 'box':
      return s.boxesOpened > 0;
    case 'hot':
      return s.hotUntil > 0;
    case 'earn':
      return s.runEarned >= g.target;
    case 'move':
      return where(s) !== g.at;
  }
}

// Цель больше не имеет смысла: переехали (уровни обнулились) или улучшение пропало.
function stale(s: GameState, g: Goal): boolean {
  if (g.kind === 'move') return false;
  if (g.at !== where(s)) return true;
  if (g.kind === 'buy' || g.kind === 'level') {
    const def = UPGRADES.find((u) => u.id === g.id);
    return !def || !isVisible(s, def);
  }
  return false;
}

// Доля выполнения для полоски, 0..1.
export function goalProgress(s: GameState, g: Goal): number {
  if (goalDone(s, g)) return 1;
  switch (g.kind) {
    case 'buy':
    case 'level': {
      const def = UPGRADES.find((u) => u.id === g.id);
      if (!def) return 0;
      const lv = s.levels[def.id] ?? 0;
      const cost = bulkCost(s, def, Math.max(1, g.target - lv));
      const done = Math.max(0, lv - g.start) / Math.max(1, g.target - g.start);
      return Math.min(0.99, done + (1 - done) * Math.min(1, s.money / Math.max(cost, 1e-9)));
    }
    case 'hot':
      return Math.min(0.99, s.heat);
    case 'earn':
      return Math.min(0.99, Math.max(0, s.runEarned - g.start) / Math.max(1, g.target - g.start));
    default:
      return 0;
  }
}

export interface GoalResult {
  state: GameState;
  done?: { goal: Goal; money: number; box: boolean };
}

// Проверка раз в тик: выдать чаевые за выполненную цель и поставить следующую.
export function checkGoal(s: GameState, now: number): GoalResult {
  if (!goalsOn(s)) return { state: s };
  if (!s.goal || stale(s, s.goal)) return { state: { ...s, goal: pickGoal(s, now) } };
  if (!goalDone(s, s.goal)) return { state: s };
  const goal = s.goal;
  // без нижней планки «100 ₽», иначе на помойке первые цели дают больше, чем ларёк
  const money = Math.max(1, Math.round(rate(s, now) * GOAL_REWARD_SEC));
  const goalsDone = s.goalsDone + 1;
  // на помойке ящиков и так хватает (первый переезд ускорился бы с 12 до 9 минут), поэтому со второй точки
  const box = goalsDone % GOAL_BOX_EVERY === 0 && where(s) > 0;
  // чаевые не считаются в путь до переезда, иначе цель «заработай» выполняла бы сама себя
  const next: GameState = { ...s, money: s.money + money, lifetimeEarned: s.lifetimeEarned + money, goalsDone };
  return { state: { ...next, goal: pickGoal(next, now) }, done: { goal, money, box } };
}
