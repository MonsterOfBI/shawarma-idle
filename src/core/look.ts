// Как выглядит ларёк. Каждое улучшение видно на точке, и с ростом уровня
// предмет «дорастает»: стадии 1–5 на уровнях 1, 10, 25, 50, 100.
// Общая сумма уровней даёт украшения: растения, гирлянду, флаг, ковёр, прожекторы.

import { UPGRADES } from './upgrades';

export const STAGE_LEVELS = [1, 10, 25, 50, 100];
export const TIER_LEVELS = [10, 25, 50, 100, 200];

export function stage(level: number): number {
  return STAGE_LEVELS.filter((l) => level >= l).length;
}

export function totalLevels(levels: Record<string, number>): number {
  return UPGRADES.reduce((n, u) => n + (levels[u.id] ?? 0), 0);
}

export function tier(levels: Record<string, number>): number {
  const total = totalLevels(levels);
  return TIER_LEVELS.filter((l) => total >= l).length;
}

export interface Look {
  stages: Record<string, number>;
  tier: number;
}

export function lookOf(levels: Record<string, number>): Look {
  const stages: Record<string, number> = {};
  for (const u of UPGRADES) stages[u.id] = stage(levels[u.id] ?? 0);
  return { stages, tier: tier(levels) };
}

export function lookKey(look: Look): string {
  return UPGRADES.map((u) => look.stages[u.id]).join('') + ':' + look.tier;
}
