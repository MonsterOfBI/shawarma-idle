// Симуляция игрока для проверки баланса: тапает с заданной частотой
// и каждую секунду покупает улучшение с лучшей окупаемостью.

import { type GameState, buy, canBuy, costOf, incomePerSecond, isMaxed, isVisible, newGame, tapValue, tick, tap } from './economy';
import { unlockAchievements } from './achievements';
import { UPGRADES } from './upgrades';

function gainPerSecond(state: GameState, tapsPerSecond: number): number {
  return incomePerSecond(state, 0) + tapValue(state, 0) * tapsPerSecond;
}

function bestUpgrade(state: GameState, tapsPerSecond: number): string | null {
  let best: string | null = null;
  let bestPayback = Infinity;
  const now = gainPerSecond(state, tapsPerSecond);
  for (const u of UPGRADES) {
    if (isMaxed(state, u) || !isVisible(state, u)) continue;
    const after = gainPerSecond({ ...state, levels: { ...state.levels, [u.id]: (state.levels[u.id] ?? 0) + 1 } }, tapsPerSecond);
    const payback = costOf(state, u) / Math.max(after - now, 1e-9);
    if (payback < bestPayback) {
      bestPayback = payback;
      best = u.id;
    }
  }
  return best;
}

// Возвращает число секунд до момента, когда runEarned достигнет цели (или maxSeconds).
export function secondsToEarn(target: number, tapsPerSecond: number, start?: GameState, maxSeconds = 6 * 3600): number {
  let s = start ?? newGame(0);
  s = { ...s, lastSeen: 0, boostUntil: 0 };
  for (let t = 1; t <= maxSeconds; t++) {
    for (let i = 0; i < tapsPerSecond; i++) s = tap(s, 0);
    s = { ...tick({ ...s, lastSeen: 0 }, 1000), lastSeen: 0 };
    s = unlockAchievements(s).state;
    let id = bestUpgrade(s, tapsPerSecond);
    while (id && canBuy(s, id)) {
      s = buy(s, id);
      id = bestUpgrade(s, tapsPerSecond);
    }
    if (s.runEarned >= target) return t;
  }
  return maxSeconds;
}
