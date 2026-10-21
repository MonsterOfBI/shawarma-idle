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

export function canClaimDaily(s: GameState, today: string, now: number): boolean {
  return s.daily.last !== today && now >= s.dailyFrom;
}

// Сколько дней между двумя датами ГГГГ-ММ-ДД (по календарю, без часовых поясов).
export function daysBetween(from: string, to: string): number {
  const ms = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  if (!from || !to) return Infinity;
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

// Какой день серии (0–6) получит игрок, если заберёт награду сегодня.
// Пропуск не обнуляет серию: каждый пропущенный день откатывает её на один шаг назад.
export function nextDailyIndex(s: GameState, today: string): number {
  const base = s.daily.streak >= 7 ? 0 : s.daily.streak;
  const missed = daysBetween(s.daily.last, today) - 1;
  if (!Number.isFinite(missed)) return 0;
  return Math.max(0, base - Math.max(0, missed));
}

// Забрать награду дня. Ящики возвращаются списком, открывает их контроллер с анимацией.
export function claimDaily(s: GameState, now: number, today: string): { state: GameState; reward: DailyReward; boxes: BoxKind[]; money: number } | null {
  if (!canClaimDaily(s, today, now)) return null;
  const i = nextDailyIndex(s, today);
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
