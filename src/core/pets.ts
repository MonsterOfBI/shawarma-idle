// Брейнроты-питомцы: выпадают из ящиков, у каждого своя редкость и бонус ко всему доходу.
// Питомцы не сгорают при переезде. Повтор того же брейнрота качает его на уровень,
// а мутации (золото, алмаз) умножают бонус. Идея взята из «Steal a Brainrot».

import type { GameState } from './economy';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'god';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'god'];

// Бонус к доходу за питомца на первом уровне (0,05 = +5 %).
export const RARITY_BONUS: Record<Rarity, number> = {
  common: 0.05,
  rare: 0.12,
  epic: 0.3,
  legendary: 0.75,
  mythic: 2,
  god: 5,
};

export const PET_RARITY: Record<string, Rarity> = {
  gusini: 'common',
  boneca: 'common',
  trippi: 'common',
  chimpanzini: 'rare',
  cappuccino: 'rare',
  frigo: 'rare',
  lirili: 'epic',
  patapim: 'epic',
  ballerina: 'epic',
  tralalero: 'legendary',
  tungtung: 'legendary',
  vaca: 'mythic',
  bombardiro: 'god',
};

export type BoxKind = 'common' | 'golden';

// Шансы редкостей в процентах.
export const BOX_ODDS: Record<BoxKind, Record<Rarity, number>> = {
  common: { common: 62, rare: 26, epic: 9, legendary: 2.5, mythic: 0.45, god: 0.05 },
  golden: { common: 0, rare: 48, epic: 33, legendary: 14, mythic: 4, god: 1 },
};

// Мутации: 0 — обычный, 1 — золотой (×2), 2 — алмазный (×5).
export const MUTATION_MULT = [1, 2, 5];
export const MUTATION_CHANCE = { gold: 0.08, diamond: 0.015 };

export interface Pet {
  count: number; // сколько раз выпал
  mut: number; // лучшая выпавшая мутация
}

export interface Drop {
  id: string;
  rarity: Rarity;
  mut: number;
  isNew: boolean;
  level: number;
}

export function petLevel(p: Pet): number {
  return p.count;
}

export function petBonus(id: string, p: Pet): number {
  const base = RARITY_BONUS[PET_RARITY[id] ?? 'common'];
  return base * (1 + 0.5 * (p.count - 1)) * MUTATION_MULT[p.mut];
}

export function petMult(s: GameState): number {
  let sum = 0;
  for (const [id, p] of Object.entries(s.pets)) if (PET_RARITY[id]) sum += petBonus(id, p);
  return 1 + sum;
}

export function rollRarity(kind: BoxKind, r: number): Rarity {
  const odds = BOX_ODDS[kind];
  let left = r * 100;
  for (const rar of RARITIES) {
    left -= odds[rar];
    if (left < 0) return rar;
  }
  return kind === 'golden' ? 'rare' : 'common';
}

// Открыть ящик: rand — источник случайных чисел от 0 до 1 (в тестах подменяется).
export function openBox(s: GameState, kind: BoxKind, rand: () => number): { state: GameState; drop: Drop } {
  const rarity = rollRarity(kind, rand());
  const pool = Object.keys(PET_RARITY).filter((id) => PET_RARITY[id] === rarity);
  const id = pool[Math.floor(rand() * pool.length) % pool.length];
  const m = rand();
  const mut = m < MUTATION_CHANCE.diamond ? 2 : m < MUTATION_CHANCE.diamond + MUTATION_CHANCE.gold ? 1 : 0;
  const old = s.pets[id];
  const pet: Pet = old ? { count: old.count + 1, mut: Math.max(old.mut, mut) } : { count: 1, mut };
  const met = s.met.includes(id) ? s.met : [...s.met, id];
  return {
    state: { ...s, pets: { ...s.pets, [id]: pet }, boxesOpened: s.boxesOpened + 1, met },
    drop: { id, rarity, mut, isNew: !old, level: pet.count },
  };
}
