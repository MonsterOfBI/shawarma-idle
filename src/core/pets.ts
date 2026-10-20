// Брейнроты-питомцы: выпадают из ящиков, у каждого своя редкость и бонус ко всему доходу.
// Питомцы не сгорают при переезде. Повтор того же брейнрота качает его на уровень,
// а мутации (золото, алмаз) умножают бонус. Идея взята из «Steal a Brainrot».

import type { GameState } from './economy';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'god';
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic', 'god'];

// Бонус к доходу за питомца на первом уровне (0,03 = +3 %).
// Урезан вдвое в версии 2.5: золотой ящик за рекламу раз в 4 минуты давал в среднем +40 % дохода навсегда,
// и реклама обесценивала всю остальную прокачку. Теперь в среднем около +20 % за ящик.
export const RARITY_BONUS: Record<Rarity, number> = {
  common: 0.03,
  rare: 0.07,
  epic: 0.15,
  legendary: 0.4,
  mythic: 1,
  god: 3,
};
// Каждый повтор питомца добавляет 30 % его базового бонуса.
export const DUPLICATE_STEP = 0.3;

export const PET_RARITY: Record<string, Rarity> = {
  gusini: 'common',
  boneca: 'common',
  trippi: 'common',
  hotspot: 'common',
  bobritto: 'common',
  golubiro: 'common',
  burbaloni: 'common',
  chimpanzini: 'rare',
  cappuccino: 'rare',
  frigo: 'rare',
  trictrac: 'rare',
  bananita: 'rare',
  glorbo: 'rare',
  lirili: 'epic',
  patapim: 'epic',
  ballerina: 'epic',
  orangutini: 'epic',
  chicleteira: 'epic',
  espresso: 'epic',
  tralalero: 'legendary',
  tungtung: 'legendary',
  spaghetti: 'legendary',
  graipuss: 'legendary',
  vaca: 'mythic',
  cannelloni: 'mythic',
  timcheese: 'common',
  tatasahur: 'common',
  zibra: 'common',
  svinino: 'rare',
  crabchef: 'rare',
  cacto: 'rare',
  ballerino: 'rare',
  tigrullini: 'epic',
  rhino: 'epic',
  cocofanto: 'legendary',
  girafa: 'mythic',
  bombardiro: 'god',
  strawberry: 'god',
};

// god — ящик из магазина за настоящие деньги: всегда божественный брейнрот.
export type BoxKind = 'common' | 'golden' | 'legend' | 'god';

// Шансы редкостей в процентах.
export const BOX_ODDS: Record<BoxKind, Record<Rarity, number>> = {
  // версия 2.12: редкие чуть чаще, чем в 2.10 (легендарный 3,2 → 4,5 %, мифический 0,65 → 1,2 %, божественный 0,15 → 0,3 %)
  common: { common: 52, rare: 29, epic: 13, legendary: 4.5, mythic: 1.2, god: 0.3 },
  golden: { common: 0, rare: 41, epic: 35, legendary: 17, mythic: 5.4, god: 1.6 },
  // легендарный ящик за переезд: только легендарные и выше
  legend: { common: 0, rare: 0, epic: 0, legendary: 75, mythic: 20, god: 5 },
  god: { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, god: 100 },
};

// Мутации: 0 — обычный, 1 — золотой (×2), 2 — алмазный (×5).
export const MUTATION_MULT = [1, 2, 5];
export const MUTATION_CHANCE = { gold: 0.08, diamond: 0.015 };

export interface Pet {
  count: number; // сколько копий сейчас (после слияния остаётся одна)
  mut: number; // лучшая выпавшая мутация
  stars: number; // звёзды слияния, от 0 до MAX_STARS
}

// Слияние (версия 2.9): три копии одного брейнрота сливаются в одного со звездой.
// Звезда умножает бонус питомца. Мутация при слиянии сохраняется, так что слить мутанта по ошибке нельзя.
export const MERGE_COPIES = 3;
export const MAX_STARS = 3;
export const STAR_MULT = [1, 2.5, 6, 15];

export function canMerge(p: Pet | undefined): boolean {
  return !!p && p.count >= MERGE_COPIES && p.stars < MAX_STARS;
}

export function mergePet(s: GameState, id: string): GameState {
  const p = s.pets[id];
  if (!canMerge(p)) return s;
  return { ...s, pets: { ...s.pets, [id]: { ...p, count: p.count - (MERGE_COPIES - 1), stars: p.stars + 1 } }, merges: s.merges + 1 };
}

export function anyMerge(s: GameState): boolean {
  return Object.entries(s.pets).some(([id, p]) => PET_RARITY[id] && canMerge(p));
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
  return base * (1 + DUPLICATE_STEP * (p.count - 1)) * MUTATION_MULT[p.mut] * STAR_MULT[p.stars ?? 0];
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
  return kind === 'god' ? 'god' : kind === 'legend' ? 'legendary' : kind === 'golden' ? 'rare' : 'common';
}

// Открыть ящик: rand — источник случайных чисел от 0 до 1 (в тестах подменяется).
export function openBox(s: GameState, kind: BoxKind, rand: () => number): { state: GameState; drop: Drop } {
  const rarity = rollRarity(kind, rand());
  const pool = Object.keys(PET_RARITY).filter((id) => PET_RARITY[id] === rarity);
  const id = pool[Math.floor(rand() * pool.length) % pool.length];
  const m = rand();
  const mut = m < MUTATION_CHANCE.diamond ? 2 : m < MUTATION_CHANCE.diamond + MUTATION_CHANCE.gold ? 1 : 0;
  const old = s.pets[id];
  const pet: Pet = old ? { count: old.count + 1, mut: Math.max(old.mut, mut), stars: old.stars ?? 0 } : { count: 1, mut, stars: 0 };
  const met = s.met.includes(id) ? s.met : [...s.met, id];
  return {
    state: { ...s, pets: { ...s.pets, [id]: pet }, boxesOpened: s.boxesOpened + 1, met },
    drop: { id, rarity, mut, isNew: !old, level: pet.count },
  };
}
