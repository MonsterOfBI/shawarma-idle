// Достижения: каждое навсегда добавляет 3 % ко всему доходу. Названия — в словаре по id.

import type { GameState } from './economy';
import { UPGRADES } from './upgrades';
import { BRAINROTS } from './brainrots';
import { PET_RARITY } from './pets';

export const ACHIEVEMENT_BONUS = 0.03;

export interface AchievementDef {
  id: string;
  check(s: GameState): boolean;
  // прогресс 0..1 для полоски в списке
  progress(s: GameState): number;
}

const staff = (s: GameState) => UPGRADES.filter((u) => u.kind === 'helper').reduce((n, u) => n + (s.levels[u.id] ?? 0), 0);

// питомцы из ящиков (без служебных записей)
const petList = (s: GameState) => Object.entries(s.pets).filter(([id]) => PET_RARITY[id]);
const petCount = (s: GameState) => petList(s).length;
const hasPet = (test: (id: string, p: { mut: number; stars: number }) => boolean) => (s: GameState) => (petList(s).some(([id, p]) => test(id, p)) ? 1 : 0);

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
  at('move_4', (s) => s.location, 4), // дворец — последняя из пяти точек
  // версия 2.18: ещё 15 — коллекция, питомцы, слияния, звёзды дворца, рекорды
  at('met_10', (s) => s.met.length, 10),
  at('pets_5', petCount, 5),
  at('merge_1', (s) => s.merges, 1),
  at('mut_1', hasPet((_, p) => p.mut > 0), 1),
  at('boxes_100', (s) => s.boxesOpened, 100),
  at('met_25', (s) => s.met.length, 25),
  at('pets_15', petCount, 15),
  at('legend_1', hasPet((id) => PET_RARITY[id] === 'legendary' || PET_RARITY[id] === 'god'), 1),
  at('combo_100', (s) => s.bestCombo, 100),
  at('merge_10', (s) => s.merges, 10),
  at('star_1', (s) => s.stars, 1),
  at('star3_1', hasPet((_, p) => p.stars >= 3), 1),
  at('god_1', hasPet((id) => PET_RARITY[id] === 'god'), 1),
  at('met_all', (s) => s.met.length, BRAINROTS.length),
  at('star_10', (s) => s.stars, 10),
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
