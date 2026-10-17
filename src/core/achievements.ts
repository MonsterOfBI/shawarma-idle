// Достижения: каждое навсегда добавляет 3 % ко всему доходу. Названия — в словаре по id.

import type { GameState } from './economy';
import { UPGRADES } from './upgrades';

export const ACHIEVEMENT_BONUS = 0.03;

export interface AchievementDef {
  id: string;
  check(s: GameState): boolean;
  // прогресс 0..1 для полоски в списке
  progress(s: GameState): number;
}

const staff = (s: GameState) => UPGRADES.filter((u) => u.kind === 'helper').reduce((n, u) => n + (s.levels[u.id] ?? 0), 0);

function at(id: string, value: (s: GameState) => number, goal: number): AchievementDef {
  return { id, check: (s) => value(s) >= goal, progress: (s) => Math.min(1, value(s) / goal) };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  at('taps_100', (s) => s.taps, 100),
  at('earn_10k', (s) => s.lifetimeEarned, 1e4),
  at('staff_10', staff, 10),
  at('golden_1', (s) => s.goldenCaught, 1),
  at('combo_25', (s) => s.bestCombo, 25),
  at('earn_1m', (s) => s.lifetimeEarned, 1e6),
  at('taps_1k', (s) => s.taps, 1000),
  at('move_1', (s) => s.location, 1),
  at('combo_50', (s) => s.bestCombo, 50),
  at('staff_50', staff, 50),
  at('earn_1b', (s) => s.lifetimeEarned, 1e9),
  at('golden_10', (s) => s.goldenCaught, 10),
  at('taps_10k', (s) => s.taps, 10000),
  at('earn_1t', (s) => s.lifetimeEarned, 1e12),
  at('move_4', (s) => s.location, 4),
];

export function achievementMult(s: GameState): number {
  return 1 + ACHIEVEMENT_BONUS * (s.achievements?.length ?? 0);
}

// Выдаёт новые достижения. Возвращает состояние и id только что полученных.
export function unlockAchievements(s: GameState): { state: GameState; unlocked: string[] } {
  const have = new Set(s.achievements);
  const unlocked = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(s)).map((a) => a.id);
  if (!unlocked.length) return { state: s, unlocked };
  return { state: { ...s, achievements: [...s.achievements, ...unlocked] }, unlocked };
}
