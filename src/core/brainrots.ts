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
  { id: 'tralalero', home: 0, role: 'customer' },
  { id: 'chimpanzini', home: 0, role: 'customer' },
  { id: 'cappuccino', home: 0, role: 'customer' },
  { id: 'tungtung', home: 0, role: 'staff' },
  { id: 'ballerina', home: 0, role: 'staff' },
  { id: 'bombardiro', home: 0, role: 'event' },
  { id: 'trippi', home: 1, role: 'customer' },
  { id: 'boneca', home: 1, role: 'customer' },
  { id: 'patapim', home: 2, role: 'customer' },
  { id: 'lirili', home: 3, role: 'customer' },
  { id: 'frigo', home: 3, role: 'customer' },
  { id: 'vaca', home: 4, role: 'customer' },
  { id: 'gusini', home: 4, role: 'customer' },
];

export const BRAINROT_BY_ID: Record<string, BrainrotDef> = Object.fromEntries(BRAINROTS.map((b) => [b.id, b]));

// Кто стоит в очереди на локации: все посетители до неё, местные — втрое чаще.
export function customerPool(location: number): { id: string; weight: number }[] {
  return BRAINROTS.filter((b) => b.role === 'customer' && b.home <= location).map((b) => ({
    id: b.id,
    weight: b.home === location ? 3 : 1,
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
