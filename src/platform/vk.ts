// Реализация Platform для VK Игр (мини-приложение ВКонтакте). Документация VK Bridge: https://dev.vk.com/ru/bridge/overview
// Мост лежит в сборке (пакет @vkontakte/vk-bridge), загружать ничего не нужно.
// Покупки за голоса и таблица игроков работают через маленький сервер на Vercel (папка api/):
// он подтверждает заказы VK и записывает очки в таблицу. Без него покупки и рейтинг выключены.

import bridge from '@vkontakte/vk-bridge';
import { lang } from '../i18n';
import { type PauseReason, type Platform, type Product, type ProductId, localLoad, localSave, onVisibility } from './platform';
import { joinSave, splitSave, vkLaunch, votesText } from './chunks';

const COUNT_KEY = 'save_n';
const chunkKey = (i: number) => `save_${i}`;
// хранилище VK разрешает 1000 запросов в час на игрока, поэтому в облако пишем не чаще раза в минуту
const CLOUD_EVERY_MS = 60_000;

// Сервер игры на Vercel (см. api/). Игра на хостинге VK — другой адрес, поэтому полный URL.
const SERVER = 'https://shawarma-idle.vercel.app';
// Цены в голосах — те же числа, что в api/_vk.ts (сервер всё равно называет VK цену сам).
const VOTES: Record<ProductId, number> = { starter_pack: 7, no_ads: 14, x2_forever: 21, cash_pack: 4, god_pet: 21 };


// Возвращает платформу VK или null, если игра открыта не во ВКонтакте.
export async function createVkPlatform(): Promise<Platform | null> {
  const launch = vkLaunch(location.search);
  if (!launch) return null;
  // покупки за голоса VK запрещает в приложении на iPhone и iPad
  const ios = /^mobile_ip/.test(new URLSearchParams(location.search).get('vk_platform') ?? '');
  try {
    await Promise.race([bridge.send('VKWebAppInit'), new Promise((_, reject) => setTimeout(reject, 5000))]);
  } catch {
    return null;
  }

  // что уже лежит в облаке, чтобы не переписывать неизменившиеся куски
  const stored: Record<string, string> = {};
  let lastCloud = 0;
  let pending: unknown = null;
  let writing = false;

  async function cloudLoad(): Promise<unknown | null> {
    const head = await bridge.send('VKWebAppStorageGet', { keys: [COUNT_KEY] });
    const count = Number(head.keys.find((k) => k.key === COUNT_KEY)?.value);
    if (!(count > 0)) return null;
    const keys = Array.from({ length: count }, (_, i) => chunkKey(i));
    const res = await bridge.send('VKWebAppStorageGet', { keys });
    const values: Record<string, string> = {};
    for (const k of res.keys) if (k.value) values[k.key] = k.value;
    const data = joinSave(count, values, chunkKey);
    if (data) Object.assign(stored, values, { [COUNT_KEY]: String(count) });
    return data;
  }

  async function cloudWrite(data: unknown) {
    const parts = splitSave(JSON.stringify(data));
    for (let i = 0; i < parts.length; i++) {
      const key = chunkKey(i);
      if (stored[key] === parts[i]) continue;
      await bridge.send('VKWebAppStorageSet', { key, value: parts[i] });
      stored[key] = parts[i];
    }
    // счётчик пишем последним: пока он старый, при загрузке соберётся прежняя целая версия
    const n = String(parts.length);
    if (stored[COUNT_KEY] !== n) {
      await bridge.send('VKWebAppStorageSet', { key: COUNT_KEY, value: n });
      stored[COUNT_KEY] = n;
    }
  }

  async function flush(force: boolean) {
    if (writing || pending === null) return;
    if (!force && Date.now() - lastCloud < CLOUD_EVERY_MS) return;
    const data = pending;
    pending = null;
    writing = true;
    lastCloud = Date.now();
    try {
      await cloudWrite(data);
    } catch {
      // облако недоступно — осталась локальная копия, попробуем со следующим сохранением
      pending ??= data;
    } finally {
      writing = false;
    }
  }

  const pauseListeners: ((paused: boolean, reason: PauseReason) => void)[] = [];
  const emitPause = (p: boolean) => pauseListeners.forEach((cb) => cb(p, 'platform'));
  bridge.subscribe((e) => {
    if (e.detail.type === 'VKWebAppViewHide') {
      emitPause(true);
      void flush(true);
    } else if (e.detail.type === 'VKWebAppViewRestore') emitPause(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) void flush(true);
  });

  // VK советует заранее проверять, есть ли реклама; заодно это её подгружает
  const hasAd = async (ad_format: 'reward' | 'interstitial') => {
    try {
      return (await bridge.send('VKWebAppCheckNativeAds', { ad_format })).result;
    } catch {
      return false;
    }
  };
  void hasAd('reward');
  void hasAd('interstitial');
  const showAd = async (ad_format: 'reward' | 'interstitial') => {
    try {
      return !!(await bridge.send('VKWebAppShowNativeAds', { ad_format })).result;
    } catch {
      return false;
    } finally {
      void hasAd(ad_format);
    }
  };

  const sendScore = async (score: number) => {
    try {
      await fetch(`${SERVER}/api/vk-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ launch: location.search, score }),
      });
    } catch {
      // сервер недоступен — отправим со следующим разом
    }
  };

  return {
    name: 'vk',
    lang: launch.lang,
    ready() {},
    gameplayStart() {},
    gameplayStop() {},
    async load() {
      const local = localLoad() as { lastSeen?: number } | null;
      try {
        const cloud = (await cloudLoad()) as { lastSeen?: number } | null;
        if (cloud && local) return (cloud.lastSeen ?? 0) >= (local.lastSeen ?? 0) ? cloud : local;
        return cloud ?? local;
      } catch {
        return local;
      }
    },
    async save(data) {
      localSave(data);
      pending = data;
      await flush(false);
    },
    showRewarded: () => showAd('reward'),
    async showInterstitial() {
      await showAd('interstitial');
    },
    purchasesAvailable: !ios,
    async getProducts() {
      if (ios) return [];
      return (Object.keys(VOTES) as ProductId[]).map((id): Product => ({ id, price: votesText(VOTES[id], lang()) }));
    },
    // Окно оплаты VK. Заказ подтверждает наш сервер (api/vk-payments.ts), игра выдаёт товар,
    // когда VK ответил «success». Разовые покупки (no_ads, x2_forever) живут в сохранении, оно в облаке VK.
    async purchase(id) {
      if (ios) return false;
      try {
        const r = await bridge.send('VKWebAppShowOrderBox', { type: 'item', item: id });
        return r.status === 'success';
      } catch {
        return false;
      }
    },
    async restorePurchases() {
      return { owned: [], pendingCash: 0, pendingGods: 0, pendingStarters: 0 };
    },
    onPause(cb) {
      pauseListeners.push(cb);
      onVisibility(cb);
    },
    // Таблица игроков VK — своя, «по очкам» за всё время: очки пишет наш сервер (api/vk-score.ts),
    // а показывает окно VK. Недельной таблицы в VK нет.
    leaderboards: false,
    isAuthorized() {
      return true;
    },
    async login() {
      return true;
    },
    async setScore(board, score) {
      if (board === 'total') await sendScore(score);
    },
    async getBoard() {
      return null;
    },
    async showNativeBoard(score) {
      await sendScore(score);
      try {
        await bridge.send('VKWebAppShowLeaderBoardBox', { user_result: Math.min(score, 2_000_000_000) });
      } catch {
        // окно не открылось (старое приложение VK) — ничего страшного
      }
    },
  };
}
