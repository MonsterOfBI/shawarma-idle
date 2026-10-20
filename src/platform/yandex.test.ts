import { describe, expect, it } from 'vitest';
import { looksLikeYandex } from './yandex';

describe('looksLikeYandex', () => {
  it('узнаёт хостинг Яндекс Игр', () => {
    expect(looksLikeYandex('app-123456.games.s3.yandex.net', '', '')).toBe(true);
    expect(looksLikeYandex('yandex.ru', '', '')).toBe(true);
    expect(looksLikeYandex('foo.bar', 'https://yandex.com/games/app/1', '')).toBe(true);
  });
  it('вне Яндекса SDK не грузим', () => {
    expect(looksLikeYandex('shawarma-idle.vercel.app', '', '')).toBe(false);
    expect(looksLikeYandex('localhost', '', '')).toBe(false);
    expect(looksLikeYandex('notyandex.net', 'https://vk.com/app1', '')).toBe(false);
    expect(looksLikeYandex('localhost', 'not a url', '')).toBe(false);
  });
  it('?yandex включает SDK для отладки', () => {
    expect(looksLikeYandex('localhost', '', '?yandex')).toBe(true);
  });
});
