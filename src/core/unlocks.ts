// Обучение по шагам (версия 2.21, после отзыва модерации VK «в обучении сложно разобраться»).
// Новичок видит только улицу и «Улучшения», остальное открывается по ходу игры, по одной функции:
// каждое открытие — маленькая награда и понятный следующий шаг, а не 9 кнопок с первой секунды.
import { FEATURES, nextMove, type Feature, type GameState } from './economy';

export { FEATURES, type Feature };

// Порядок примерно такой: брейнроты (~1 мин) → задания (~2–3 мин) → ящик за рекламу → подарок дня и ×2 (5 мин)
// → переезд (5 % пути) → магазин (25 % пути). После первого переезда открыто всё.
export function shouldUnlock(s: GameState, f: Feature, now: number): boolean {
  if (s.location > 0 || s.stars > 0) return true;
  const path = s.runEarned / nextMove(s).threshold;
  switch (f) {
    case 'pets':
      return (s.levels.grill_helper ?? 0) >= 1 || s.boxesOpened > 0;
    case 'quests':
      return s.boxesOpened >= 1 && s.bought >= 8;
    case 'adbox':
      return s.questsDone >= 1 || s.boxesOpened >= 3;
    case 'daily':
      return now >= s.dailyFrom || s.daily.last !== '';
    case 'boost':
      return s.daily.last !== '' || path >= 0.1;
    case 'move':
      return path >= 0.05;
    case 'shop':
      return path >= 0.25;
  }
}

export function isUnlocked(s: GameState, f: Feature): boolean {
  return s.unlocked.includes(f);
}

// Открывает всё, что пора открыть. Возвращает новое состояние и список только что открытого (для «Новое!»).
export function checkUnlocks(s: GameState, now: number): { state: GameState; fresh: Feature[] } {
  const fresh = FEATURES.filter((f) => !s.unlocked.includes(f) && shouldUnlock(s, f, now));
  if (!fresh.length) return { state: s, fresh };
  return { state: { ...s, unlocked: [...s.unlocked, ...fresh] }, fresh };
}
