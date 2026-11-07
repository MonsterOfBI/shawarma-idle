// Как выглядит ларёк. Каждое улучшение видно на точке, и с ростом уровня
// предмет «дорастает»: стадии 1–6 на уровнях 1, 10, 25, 50, 100, 200.
// С каждой стадией ларёк становится шире (growth): пристраивается гриль-зал с новыми вертелами и т. д.
// Общая сумма уровней даёт украшения: растения, гирлянду, флаг, ковёр, прожекторы.

import { UPGRADES } from './upgrades';

export const STAGE_LEVELS = [1, 10, 25, 50, 100, 200];
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

// Сколько стадий вообще может набрать улучшение (у разовых — одна).
export function maxStage(id: string): number {
  const u = UPGRADES.find((x) => x.id === id);
  return u?.maxLevel ? stage(u.maxLevel) : STAGE_LEVELS.length;
}

// Насколько ларёк «дорос»: 0 — пустой, 1 — всё на последней стадии.
export function growth(look: Look): number {
  let got = 0, max = 0;
  for (const u of UPGRADES) {
    got += Math.min(look.stages[u.id] ?? 0, maxStage(u.id));
    max += maxStage(u.id);
  }
  return max ? got / max : 0;
}

// Ларёк на максимуме: по нему сцена выбирает масштаб, чтобы маленький ларёк и выглядел маленьким.
export function maxLook(): Look {
  const levels: Record<string, number> = {};
  for (const u of UPGRADES) levels[u.id] = u.maxLevel ?? STAGE_LEVELS[STAGE_LEVELS.length - 1];
  return lookOf(levels);
}

// Что изменилось на ларьке после покупки: новые предметы (стадия 0 → 1) и подросшие.
export function lookChanges(before: Look, after: Look): { id: string; fresh: boolean }[] {
  const out: { id: string; fresh: boolean }[] = [];
  for (const u of UPGRADES) {
    const a = before.stages[u.id] ?? 0, b = after.stages[u.id] ?? 0;
    if (b > a) out.push({ id: u.id, fresh: a === 0 });
  }
  return out;
}
