// Таблица улучшений. Названия и описания живут в словаре (src/i18n.ts) по id.

export type UpgradeKind = 'tap' | 'helper' | 'mult';

export interface UpgradeDef {
  id: string;
  kind: UpgradeKind;
  baseCost: number;
  // tap: + к доходу за тап за уровень; helper: + к доходу в секунду за уровень;
  // mult: во сколько раз умножает доход (тап и/или секунды, см. target)
  amount: number;
  target?: 'all' | 'tap';
  maxLevel?: number;
}

const GROWTH = 1.15;

export const UPGRADES: UpgradeDef[] = [
  { id: 'knife', kind: 'tap', baseCost: 10, amount: 1 },
  { id: 'grill_helper', kind: 'helper', baseCost: 15, amount: 0.2 },
  { id: 'cashier', kind: 'helper', baseCost: 100, amount: 1 },
  { id: 'lavash', kind: 'tap', baseCost: 150, amount: 3 },
  { id: 'second_spit', kind: 'helper', baseCost: 1_100, amount: 8 },
  { id: 'sauce', kind: 'tap', baseCost: 2_000, amount: 15 },
  { id: 'sign', kind: 'mult', baseCost: 5_000, amount: 2, target: 'all', maxLevel: 1 },
  { id: 'courier', kind: 'helper', baseCost: 12_000, amount: 47 },
  { id: 'cheese', kind: 'tap', baseCost: 30_000, amount: 80 },
  { id: 'reviews', kind: 'mult', baseCost: 100_000, amount: 2, target: 'all', maxLevel: 1 },
  { id: 'window', kind: 'helper', baseCost: 130_000, amount: 260 },
  { id: 'double', kind: 'tap', baseCost: 500_000, amount: 500 },
  { id: 'night_shift', kind: 'helper', baseCost: 1_400_000, amount: 1400 },
  { id: 'cashback', kind: 'mult', baseCost: 3_000_000, amount: 3, target: 'tap', maxLevel: 1 },
  { id: 'secret', kind: 'tap', baseCost: 8_000_000, amount: 3000 },
  { id: 'franchise', kind: 'helper', baseCost: 20_000_000, amount: 7800 },
  { id: 'meme_ads', kind: 'mult', baseCost: 80_000_000, amount: 3, target: 'all', maxLevel: 1 },
  { id: 'food_truck', kind: 'helper', baseCost: 330_000_000, amount: 44000 },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(def: UpgradeDef, level: number): number {
  return Math.ceil(def.baseCost * Math.pow(GROWTH, level));
}
