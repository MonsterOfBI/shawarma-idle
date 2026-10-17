// Итальянские брейнрот-персонажи: посетители, работники и гости-события.
// home — индекс локации, где персонаж впервые появляется. Имена и фразы — в словаре.

import type { GameState } from './economy';

export type BrainrotRole = 'customer' | 'staff' | 'event';

export interface BrainrotDef {
  id: string;
  home: number;
  role: BrainrotRole;
}

export const BRAINROTS: BrainrotDef[] = [
  // работники и событие — на всех точках
  { id: 'tungtung', home: 0, role: 'staff' },
  { id: 'ballerina', home: 0, role: 'staff' },
  { id: 'bombardiro', home: 0, role: 'event' },
  // 0 — коробка у помойки: бродяги и бандиты
  { id: 'chimpanzini', home: 0, role: 'customer' },
  { id: 'boneca', home: 0, role: 'customer' },
  { id: 'bobritto', home: 0, role: 'customer' },
  // 1 — ларёк у метро: город, офис, уличные музыканты
  { id: 'cappuccino', home: 1, role: 'customer' },
  { id: 'hotspot', home: 1, role: 'customer' },
  { id: 'golubiro', home: 1, role: 'customer' },
  { id: 'trictrac', home: 1, role: 'customer' },
  // 2 — пляж: морские
  { id: 'tralalero', home: 2, role: 'customer' },
  { id: 'trippi', home: 2, role: 'customer' },
  { id: 'bananita', home: 2, role: 'customer' },
  { id: 'burbaloni', home: 2, role: 'customer' },
  // 3 — джунгли
  { id: 'patapim', home: 3, role: 'customer' },
  { id: 'orangutini', home: 3, role: 'customer' },
  { id: 'glorbo', home: 3, role: 'customer' },
  // 4 — пустыня
  { id: 'lirili', home: 4, role: 'customer' },
  { id: 'frigo', home: 4, role: 'customer' },
  { id: 'chicleteira', home: 4, role: 'customer' },
  // 5 — итальянская площадь
  { id: 'vaca', home: 5, role: 'customer' },
  { id: 'gusini', home: 5, role: 'customer' },
  { id: 'espresso', home: 5, role: 'customer' },
  { id: 'spaghetti', home: 5, role: 'customer' },
  // 6 — дворец: самые редкие звёзды
  { id: 'strawberry', home: 6, role: 'customer' },
  { id: 'cannelloni', home: 6, role: 'customer' },
  { id: 'graipuss', home: 6, role: 'customer' },
];

export const BRAINROT_BY_ID: Record<string, BrainrotDef> = Object.fromEntries(BRAINROTS.map((b) => [b.id, b]));

// Кто стоит в очереди на локации: у каждой точки свои персонажи.
// Гости с прошлой точки иногда заглядывают (вес 1 против 8 у местных), остальные не приходят.
export function customerPool(location: number): { id: string; weight: number }[] {
  return BRAINROTS.filter((b) => b.role === 'customer' && (b.home === location || b.home === location - 1)).map((b) => ({
    id: b.id,
    weight: b.home === location ? 8 : 1,
  }));
}

export function pickCustomer(location: number, random: number): string {
  const pool = customerPool(location);
  const total = pool.reduce((n, p) => n + p.weight, 0);
  let r = random * total;
  for (const p of pool) {
    r -= p.weight;
    if (r < 0) return p.id;
  }
  return pool[pool.length - 1].id;
}

// Отмечает знакомство с персонажем. Возвращает то же состояние, если уже знакомы.
export function meet(s: GameState, id: string): GameState {
  if (!BRAINROT_BY_ID[id] || s.met.includes(id)) return s;
  return { ...s, met: [...s.met, id] };
}
