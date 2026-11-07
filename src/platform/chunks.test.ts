import { describe, expect, it } from 'vitest';
import { joinSave, splitSave, vkLaunch } from './chunks';
import { votesText } from './chunks';

describe('сохранение кусками для VK', () => {
  const key = (i: number) => `save${i}`;
  const toValues = (parts: string[]) => Object.fromEntries(parts.map((p, i) => [key(i), p]));

  it('собирает обратно то же самое', () => {
    const state = { money: 1e15, pets: Array.from({ length: 200 }, (_, i) => ({ id: `br${i}`, stars: i % 4 })), name: 'Шаурма' };
    const parts = splitSave(JSON.stringify(state));
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(4096);
    expect(joinSave(parts.length, toValues(parts), key)).toEqual(state);
  });

  it('кириллица не вылезает за 4096 байт', () => {
    const parts = splitSave('ш'.repeat(5000));
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(4096);
  });

  it('без куска или со сломанным JSON — null', () => {
    const parts = splitSave(JSON.stringify({ a: 'x'.repeat(3000) }));
    const values = toValues(parts);
    delete values[key(1)];
    expect(joinSave(parts.length, values, key)).toBeNull();
    expect(joinSave(1, { save0: '{oops' }, key)).toBeNull();
    expect(joinSave(0, {}, key)).toBeNull();
  });
});

describe('параметры запуска VK', () => {
  it('узнаёт VK по vk_app_id и sign', () => {
    expect(vkLaunch('?vk_app_id=123&vk_language=en&sign=abc')).toEqual({ appId: '123', lang: 'en' });
    expect(vkLaunch('?vk_app_id=123&sign=abc')?.lang).toBe('ru');
  });
  it('вне VK — null', () => {
    expect(vkLaunch('')).toBeNull();
    expect(vkLaunch('?vk_app_id=123')).toBeNull();
  });
});

describe('votesText', () => {
  it('склоняет голоса', () => {
    expect(votesText(1, 'ru')).toBe('1 голос');
    expect(votesText(4, 'ru')).toBe('4 голоса');
    expect(votesText(7, 'ru')).toBe('7 голосов');
    expect(votesText(11, 'ru')).toBe('11 голосов');
    expect(votesText(21, 'ru')).toBe('21 голос');
    expect(votesText(14, 'en')).toBe('14 votes');
  });
});
