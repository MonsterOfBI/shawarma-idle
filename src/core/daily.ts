// Календарь ежедневных наград на 7 дней. Пропустил день — серия начинается заново.
// Даты передаются строками ГГГГ-ММ-ДД, чтобы логика не зависела от часов браузера.

import { type GameState, addMoney, minutesOfIncome } from './economy';
import type { BoxKind } from './pets';

export interface DailyReward {
  minutes?: number; // деньги: доход за столько минут
  box?: BoxKind;
  boxes?: number;
}

export const DAILY: DailyReward[] = [
  { minutes: 5 },
  { minutes: 10 },
  { box: 'common', boxes: 1 },
  { minutes: 20 },
  { box: 'common', boxes: 2 },
  { minutes: 40 },
  { box: 'golden', boxes: 1 },
];

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function canClaimDaily(s: GameState, today: string): boolean {
  return s.daily.last !== today;
}

// Какой день серии (0–6) получит игрок, если заберёт награду сегодня.
export function nextDailyIndex(s: GameState, yesterday: string): number {
  if (s.daily.last !== yesterday || s.daily.streak >= 7) return 0;
  return s.daily.streak;
}

// Забрать награду дня. Ящики возвращаются списком, открывает их контроллер с анимацией.
export function claimDaily(s: GameState, now: number, today: string, yesterday: string): { state: GameState; reward: DailyReward; boxes: BoxKind[]; money: number } | null {
  if (!canClaimDaily(s, today)) return null;
  const i = nextDailyIndex(s, yesterday);
  const reward = DAILY[i];
  let state: GameState = { ...s, daily: { streak: i + 1, last: today } };
  let money = 0;
  if (reward.minutes) {
    money = minutesOfIncome(s, now, reward.minutes);
    state = addMoney(state, money);
  }
  const boxes: BoxKind[] = reward.box ? Array.from({ length: reward.boxes ?? 1 }, () => reward.box!) : [];
  return { state, reward, boxes, money };
}
