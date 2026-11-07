// Недельный сундук (версия 2.18): зашёл в игру 5 разных дней из 7 календарных
// (понедельник–воскресенье) — забирай легендарный ящик. Мягче строгой серии подарка дня
// и тянет игрока возвращаться: Яндекс считает рейтинг по возвратам.
// Даты — строки ГГГГ-ММ-ДД, как в daily.ts.

import type { GameState } from './economy';
import type { BoxKind } from './pets';

export const WEEKLY_DAYS = 5;
export const WEEKLY_BOX: BoxKind = 'legendary';

export interface Weekly {
  week: string; // понедельник недели, ГГГГ-ММ-ДД
  days: string[]; // дни этой недели, когда игрок заходил
  claimed: boolean;
}

export function emptyWeekly(): Weekly {
  return { week: '', days: [], claimed: false };
}

// Понедельник недели, в которую попадает дата.
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const shift = (t.getUTCDay() + 6) % 7; // пн = 0
  t.setUTCDate(t.getUTCDate() - shift);
  return t.toISOString().slice(0, 10);
}

// Номер дня недели 0..6 (пн..вс).
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay() + 6) % 7;
}

// Отметить, что игрок сегодня в игре. Возвращает то же состояние, если ничего не изменилось.
export function markPlayed(s: GameState, today: string): GameState {
  const week = weekStart(today);
  if (s.weekly.week !== week) return { ...s, weekly: { week, days: [today], claimed: false } };
  if (s.weekly.days.includes(today)) return s;
  return { ...s, weekly: { ...s.weekly, days: [...s.weekly.days, today] } };
}

export function canClaimWeekly(s: GameState, today: string): boolean {
  return s.weekly.week === weekStart(today) && !s.weekly.claimed && s.weekly.days.length >= WEEKLY_DAYS;
}

export function claimWeekly(s: GameState, today: string): { state: GameState; box: BoxKind } | null {
  if (!canClaimWeekly(s, today)) return null;
  return { state: { ...s, weekly: { ...s.weekly, claimed: true } }, box: WEEKLY_BOX };
}
