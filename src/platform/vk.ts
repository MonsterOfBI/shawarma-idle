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
const VK_MOBILE_HEADER = 36;

// Сервер игры для VK на хостинге Beget (папка server/beget/, PHP), он в России и открывается без VPN.
// Пустая строка — сервера нет: таблица игроков выключена. Адрес без «/» в конце.
const SERVER: string = 'https://shaurma-brainrot.ru';
// Донат за голоса: VK шлёт заказы на SERVER/vk-payments.php (адрес вписан в настройках «Платежи»).
const SHOP: boolean = true;
const USE_SERVER = SERVER !== '';
// VK запрещает рекламу сразу после запуска: первая полноэкранная — не раньше чем через 3 минуты.
const NO_AD_AFTER_START_MS = 3 * 60_000;
const startedAt = Date.now();
// Цены в голосах — те же числа, что в api/_vk.ts (сервер всё равно называет VK цену сам).
const VOTES: Record<ProductId, number> = { starter_pack: 7, no_ads: 14, x2_forever: 21, cash_pack: 4, god_pet: 21 };


// Возвращает платформу VK или null, если игра открыта не во ВКонтакте.
export async function createVkPlatform(): Promise<Platform | null> {
  const launch = vkLaunch(location.search);
  if (!launch) return null;
  // покупки за голоса VK запрещает в приложении на iPhone и iPad
  const noShop = !SHOP || !USE_SERVER || /^mobile_ip/.test(new URLSearchParams(location.search).get('vk_platform') ?? '');
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
  // m.vk.ru в мобильном браузере: VK растягивает кадр с игрой под нижнюю панель Safari, и меню уходит под неё.
  // VK присылает высоту видимой части своей страницы (viewport_height); выше кадра у VK шапка ~36 px.
  const mobileWeb = /^mobile_web/.test(new URLSearchParams(location.search).get('vk_platform') ?? '');
  const applyConfig = (data: unknown) => {
    const h = (data as { viewport_height?: number } | null)?.viewport_height;
    if (!mobileWeb || !h || h < 200) return;
    (window as { vkMaxHeight?: number }).vkMaxHeight = h - VK_MOBILE_HEADER;
    window.dispatchEvent(new Event('resize'));
  };
  void bridge.send('VKWebAppGetConfig').then(applyConfig).catch(() => {});
  bridge.subscribe((e) => {
    if (e.detail.type === 'VKWebAppUpdateConfig') applyConfig(e.detail.data);
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
    if (!USE_SERVER) return;
    try {
      await fetch(`${SERVER}/vk-score.php`, {
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
      if (Date.now() - startedAt < NO_AD_AFTER_START_MS) return;
      await showAd('interstitial');
    },
    purchasesAvailable: !noShop,
    async getProducts() {
      if (noShop) return [];
      return (Object.keys(VOTES) as ProductId[]).map((id): Product => ({ id, price: votesText(VOTES[id], lang()) }));
    },
    // Окно оплаты VK. Заказ подтверждает наш сервер (api/vk-payments.ts), игра выдаёт товар,
    // когда VK ответил «success». Разовые покупки (no_ads, x2_forever) живут в сохранении, оно в облаке VK.
    async purchase(id) {
      if (noShop) return false;
      try {
        const r = await bridge.send('VKWebAppShowOrderBox', { type: 'item', item: id });
        // Старый ответ VK — { status: 'success' }, нынешний — { success: true }: принимаем оба.
        return r.status === 'success' || (r as { success?: boolean }).success === true;
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
    showNativeBoard: USE_SERVER ? showBoard : undefined,
  };

  async function showBoard(score: number) {
      await sendScore(score);
      try {
        await bridge.send('VKWebAppShowLeaderBoardBox', { user_result: Math.min(score, 10_000_000) });
      } catch {
        // окно не открылось (старое приложение VK) — ничего страшного
      }
  }
}
