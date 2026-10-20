// Задания: всегда три штуки. Выполнил — забрал награду, на место приходит новое, чуть сложнее.

import { type GameState, type Quest, type QuestKind, addMoney, incomePerSecond, minutesOfIncome, tapValue } from './economy';
import type { BoxKind } from './pets';

export const QUEST_SLOTS = 3;

export function counter(s: GameState, kind: QuestKind): number {
  switch (kind) {
    case 'taps':
      return s.taps;
    case 'buy':
      return s.bought;
    case 'golden':
      return s.goldenCaught;
    case 'box':
      return s.boxesOpened;
    case 'earn':
      return s.lifetimeEarned;
    case 'combo':
      return s.bestCombo;
  }
}

export function questProgress(s: GameState, q: Quest): number {
  const done = q.kind === 'combo' ? counter(s, 'combo') : counter(s, q.kind) - q.start;
  return Math.min(1, Math.max(0, done / q.target));
}

export function questDone(s: GameState, q: Quest): boolean {
  return questProgress(s, q) >= 1;
}

function makeQuest(s: GameState, now: number, kind: QuestKind, r: number): Quest {
  const step = 1 + Math.min(s.questsDone, 40) * 0.15; // задания медленно усложняются
  const reward: { minutes?: number; box?: BoxKind } = r < 0.25 ? { box: r < 0.04 ? 'golden' : 'common' } : { minutes: Math.round(1 + 1.5 * step) }; // версия 2.11: награда деньгами в 4 раза меньше
  switch (kind) {
    case 'taps':
      return { kind, target: Math.round(80 * step / 10) * 10, start: s.taps, reward };
    case 'buy':
      return { kind, target: Math.round(8 * step), start: s.bought, reward };
    case 'golden':
      return { kind, target: step > 3 ? 2 : 1, start: s.goldenCaught, reward };
    case 'box':
      return { kind, target: step > 2.5 ? 2 : 1, start: s.boxesOpened, reward };
    case 'combo':
      return { kind, target: Math.min(50, Math.max(s.bestCombo + 5, Math.round(15 * step))), start: 0, reward };
    case 'earn': {
      const per = incomePerSecond(s, now, false) + tapValue({ ...s, tapFrenzyUntil: 0 }, now) * 2;
      return { kind, target: Math.max(500, Math.round(per * 60 * 4 * step)), start: s.lifetimeEarned, reward };
    }
  }
}

const KINDS: QuestKind[] = ['taps', 'buy', 'golden', 'box', 'earn', 'combo'];

// Добирает задания до трёх, не повторяя виды.
export function ensureQuests(s: GameState, now: number, rand: () => number): GameState {
  if (s.quests.length >= QUEST_SLOTS) return s;
  const quests = [...s.quests];
  while (quests.length < QUEST_SLOTS) {
    const free = KINDS.filter((k) => !quests.some((q) => q.kind === k) && !(k === 'combo' && s.bestCombo >= 50));
    const kind = free[Math.floor(rand() * free.length) % free.length];
    quests.push(makeQuest(s, now, kind, rand()));
  }
  return { ...s, quests };
}

export function claimQuest(s: GameState, i: number, now: number, rand: () => number): { state: GameState; box?: BoxKind; money: number } | null {
  const q = s.quests[i];
  if (!q || !questDone(s, q)) return null;
  let state: GameState = { ...s, quests: s.quests.filter((_, k) => k !== i), questsDone: s.questsDone + 1 };
  let money = 0;
  if (q.reward.minutes) {
    // задания из старых сохранений тоже платят по-новому, не больше 12 минут
    money = minutesOfIncome(s, now, Math.min(q.reward.minutes, 12));
    state = addMoney(state, money);
  }
  state = ensureQuests(state, now, rand);
  return { state, box: q.reward.box, money };
}
