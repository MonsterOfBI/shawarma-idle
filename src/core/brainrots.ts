// Итальянские брейнрот-персонажи: посетители, работники и гости-события.
// home — индекс локации, где персонаж впервые появляется. Имена и фразы — в словаре.

import type { GameState } from './economy';

export type BrainrotRole = 'customer' | 'staff' | 'event';

export interface BrainrotDef {
  id: string;
  home: number;
  role: BrainrotRole;
  // во сколько раз чек этого гостя больше обычного (1 — средний гость)
  pay?: number;
}

export const BRAINROTS: BrainrotDef[] = [
  // работники и событие — на всех точках
  { id: 'tungtung', home: 0, role: 'staff' },
  { id: 'ballerina', home: 0, role: 'staff' },
  { id: 'bombardiro', home: 0, role: 'event' },
  // 0 — коробка у помойки: бродяги, бандиты и дворовые
  { id: 'chimpanzini', home: 0, role: 'customer', pay: 0.8 },
  { id: 'boneca', home: 0, role: 'customer', pay: 0.6 },
  { id: 'bobritto', home: 0, role: 'customer', pay: 1.6 },
  { id: 'timcheese', home: 0, role: 'customer', pay: 0.5 },
  { id: 'svinino', home: 0, role: 'customer', pay: 1.2 },
  { id: 'golubiro', home: 0, role: 'customer', pay: 0.6 },
  { id: 'zibra', home: 0, role: 'customer', pay: 0.8 },
  // 1 — ларёк у метро: город, офис, морские гости с вокзала
  { id: 'cappuccino', home: 1, role: 'customer', pay: 1.3 },
  { id: 'hotspot', home: 1, role: 'customer', pay: 0.7 },
  { id: 'trictrac', home: 1, role: 'customer', pay: 1 },
  { id: 'tatasahur', home: 1, role: 'customer', pay: 0.9 },
  { id: 'trippi', home: 1, role: 'customer', pay: 0.7 },
  { id: 'burbaloni', home: 1, role: 'customer', pay: 1.1 },
  { id: 'bananita', home: 1, role: 'customer', pay: 0.9 },
  // 2 — пустыня: кактусы, джунгли по соседству и путешественники
  { id: 'lirili', home: 2, role: 'customer', pay: 1.3 },
  { id: 'frigo', home: 2, role: 'customer', pay: 1 },
  { id: 'chicleteira', home: 2, role: 'customer', pay: 0.8 },
  { id: 'cacto', home: 2, role: 'customer', pay: 0.7 },
  { id: 'rhino', home: 2, role: 'customer', pay: 1.7 },
  { id: 'patapim', home: 2, role: 'customer', pay: 1.2 },
  { id: 'glorbo', home: 2, role: 'customer', pay: 0.7 },
  // 3 — итальянская площадь: туристы и звёзды мемов
  { id: 'vaca', home: 3, role: 'customer', pay: 2 },
  { id: 'gusini', home: 3, role: 'customer', pay: 0.6 },
  { id: 'espresso', home: 3, role: 'customer', pay: 1.2 },
  { id: 'spaghetti', home: 3, role: 'customer', pay: 1 },
  { id: 'ballerino', home: 3, role: 'customer', pay: 0.9 },
  { id: 'tralalero', home: 3, role: 'customer', pay: 1.6 },
  { id: 'crabchef', home: 3, role: 'customer', pay: 1.3 },
  // 4 — дворец: самые редкие и богатые звёзды
  { id: 'strawberry', home: 4, role: 'customer', pay: 3 },
  { id: 'cannelloni', home: 4, role: 'customer', pay: 2.2 },
  { id: 'graipuss', home: 4, role: 'customer', pay: 1.4 },
  { id: 'cocofanto', home: 4, role: 'customer', pay: 1.6 },
  { id: 'girafa', home: 4, role: 'customer', pay: 2.5 },
  { id: 'tigrullini', home: 4, role: 'customer', pay: 1.6 },
  { id: 'orangutini', home: 4, role: 'customer', pay: 0.9 },
];

export const BRAINROT_BY_ID: Record<string, BrainrotDef> = Object.fromEntries(BRAINROTS.map((b) => [b.id, b]));

// Кто стоит в очереди на локации: у каждой точки свои персонажи.
// Гости с прошлой точки иногда заглядывают (вес 1 против 8 у местных), остальные не приходят.
// Богатые гости (чек от ×1,5) приходят вдвое реже обычных.
export function customerPool(location: number): { id: string; weight: number }[] {
  return BRAINROTS.filter((b) => b.role === 'customer' && (b.home === location || b.home === location - 1)).map((b) => ({
    id: b.id,
    weight: (b.home === location ? 8 : 1) * ((b.pay ?? 1) >= 1.5 ? 0.5 : 1),
  }));
}

// Множитель чека гостя: у каждого брейнрота свой.
export function payOf(id: string): number {
  return BRAINROT_BY_ID[id]?.pay ?? 1;
}

// Средний множитель чека на локации с учётом того, кто как часто приходит (для симуляции баланса).
export function averagePay(location: number): number {
  const pool = customerPool(location);
  const total = pool.reduce((n, p) => n + p.weight, 0);
  return pool.reduce((n, p) => n + p.weight * payOf(p.id), 0) / total;
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
