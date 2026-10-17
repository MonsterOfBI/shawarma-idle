// Чистая логика экономики: без Phaser и без браузера, чтобы её можно было тестировать.

export type UpgradeId = 'recipe' | 'helper';

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  description: string;
  baseCost: number;
  costGrowth: number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  recipe: {
    id: 'recipe',
    title: 'Рецепт получше',
    description: '+1 ₽ за каждую шаурму с кассы',
    baseCost: 10,
    costGrowth: 1.15,
  },
  helper: {
    id: 'helper',
    title: 'Помощник у гриля',
    description: '+1 ₽ в секунду, даже без тапов',
    baseCost: 25,
    costGrowth: 1.12,
  },
};

// Офлайн-доход начисляется не больше чем за 2 часа отсутствия.
export const OFFLINE_CAP_SECONDS = 2 * 60 * 60;

export interface GameState {
  money: number;
  levels: Record<UpgradeId, number>;
  lastSeen: number; // мс, Date.now()
}

export function newGame(now: number): GameState {
  return { money: 0, levels: { recipe: 0, helper: 0 }, lastSeen: now };
}

export function tapValue(state: GameState): number {
  return 1 + state.levels.recipe;
}

export function incomePerSecond(state: GameState): number {
  return state.levels.helper;
}

export function upgradeCost(id: UpgradeId, level: number): number {
  const def = UPGRADES[id];
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, level));
}

export function tap(state: GameState): GameState {
  return { ...state, money: state.money + tapValue(state) };
}

export function canBuy(state: GameState, id: UpgradeId): boolean {
  return state.money >= upgradeCost(id, state.levels[id]);
}

export function buy(state: GameState, id: UpgradeId): GameState {
  if (!canBuy(state, id)) return state;
  const cost = upgradeCost(id, state.levels[id]);
  return {
    ...state,
    money: state.money - cost,
    levels: { ...state.levels, [id]: state.levels[id] + 1 },
  };
}

// Начисляет доход за прошедшее время; используется и каждый кадр, и при возвращении игрока.
export function tick(state: GameState, now: number): { state: GameState; earned: number } {
  const seconds = Math.min(Math.max(0, (now - state.lastSeen) / 1000), OFFLINE_CAP_SECONDS);
  const earned = incomePerSecond(state) * seconds;
  return { state: { ...state, money: state.money + earned, lastSeen: now }, earned };
}
