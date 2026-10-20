// Задания: всегда три штуки. Выполнил — забрал награду, на место приходит новое, чуть сложнее.

import { type GameState, type Quest, type QuestKind, addMoney, incomePerSecond, minutesOfIncome, tapValue } from './economy';
import type { BoxKind } from './pets';

export const QUEST_SLOTS = 3;

// Версия 2.15: задания давали 86 % всех денег и игра проходилась за 1 ч 40 мин вместо 7 часов.
// Теперь новое задание приходит через 20 минут после выполненного, цели втрое больше,
// а награда деньгами — ровно 2 минуты дохода. Заданий около 8 в час, это ~17 % денег.
export const QUEST_REFILL_MS = 20 * 60 * 1000;
export const QUEST_TARGET_MULT = 3;
export const QUEST_MINUTES = 2;
export const QUEST_BOX_CHANCE = 0.2;
export const QUEST_GOLD_CHANCE = 0.03;

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
  const reward: { minutes?: number; box?: BoxKind } = r < QUEST_BOX_CHANCE ? { box: r < QUEST_GOLD_CHANCE ? 'golden' : 'common' } : { minutes: QUEST_MINUTES };
  const x = QUEST_TARGET_MULT;
  switch (kind) {
    case 'taps':
      return { kind, target: Math.round((80 * step * x) / 10) * 10, start: s.taps, reward };
    case 'buy':
      return { kind, target: Math.round(8 * step * x), start: s.bought, reward };
    case 'golden':
      return { kind, target: step > 3 ? 2 : 1, start: s.goldenCaught, reward };
    case 'box':
      return { kind, target: step > 2.5 ? 2 : 1, start: s.boxesOpened, reward };
    case 'combo':
      return { kind, target: Math.min(50, Math.max(s.bestCombo + 5, Math.round(15 * step))), start: 0, reward };
    case 'earn': {
      const per = incomePerSecond(s, now, false) + tapValue({ ...s, tapFrenzyUntil: 0 }, now) * 2;
      return { kind, target: Math.max(500, Math.round(per * 60 * 4 * step * x)), start: s.lifetimeEarned, reward };
    }
  }
}

// После переезда улучшения обнуляются и доход падает почти до нуля, а цель «Заработать»
// осталась от богатой старой точки и висела бы часами. Пересчитываем её по новой точке.
export function refreshEarnQuests(s: GameState, now: number): GameState {
  if (!s.quests.some((q) => q.kind === 'earn')) return s;
  const quests = s.quests.map((q) => {
    if (q.kind !== 'earn') return q;
    const fresh = makeQuest(s, now, 'earn', 1);
    return { ...q, target: fresh.target, start: s.lifetimeEarned };
  });
  return { ...s, quests };
}

const KINDS: QuestKind[] = ['taps', 'buy', 'golden', 'box', 'earn', 'combo'];

// Сколько мест ждут новое задание и когда придёт ближайшее (null — никто не ждёт).
export function nextQuestAt(s: GameState): number | null {
  const waits = (s.questWait ?? []).slice(0, QUEST_SLOTS - s.quests.length);
  return waits.length ? Math.min(...waits) : null;
}

// Добирает задания до трёх, не повторяя виды. Место выполненного задания ждёт QUEST_REFILL_MS.
export function ensureQuests(s: GameState, now: number, rand: () => number): GameState {
  if (s.quests.length >= QUEST_SLOTS) return s;
  const free = QUEST_SLOTS - s.quests.length;
  const waits = [...(s.questWait ?? [])].sort((a, b) => a - b).slice(0, free);
  const pending = waits.filter((t) => t > now);
  const add = free - pending.length;
  if (add <= 0) return s.questWait === waits || sameList(s.questWait, waits) ? s : { ...s, questWait: waits };
  const quests = [...s.quests];
  while (quests.length < s.quests.length + add) {
    const free = KINDS.filter((k) => !quests.some((q) => q.kind === k) && !(k === 'combo' && s.bestCombo >= 50));
    const kind = free[Math.floor(rand() * free.length) % free.length];
    quests.push(makeQuest(s, now, kind, rand()));
  }
  return { ...s, quests, questWait: pending };
}

function sameList(a: number[] | undefined, b: number[]): boolean {
  return !!a && a.length === b.length && a.every((v, i) => v === b[i]);
}

export function claimQuest(s: GameState, i: number, now: number, rand: () => number): { state: GameState; box?: BoxKind; money: number } | null {
  const q = s.quests[i];
  if (!q || !questDone(s, q)) return null;
  let state: GameState = { ...s, quests: s.quests.filter((_, k) => k !== i), questsDone: s.questsDone + 1, questWait: [...(s.questWait ?? []), now + QUEST_REFILL_MS] };
  let money = 0;
  if (q.reward.minutes) {
    // задания из старых сохранений тоже платят по-новому
    money = minutesOfIncome(s, now, Math.min(q.reward.minutes, QUEST_MINUTES));
    state = addMoney(state, money);
  }
  state = ensureQuests(state, now, rand);
  return { state, box: q.reward.box, money };
}
