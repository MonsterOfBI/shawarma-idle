// Реализация Platform для Яндекс Игр. Документация SDK: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
// SDK подключается скриптом /sdk.js, который Яндекс отдаёт со своего хостинга игры.

import { type Board, type LbEntry, type PauseReason, type Platform, type Product, type ProductId, localLoad, localSave, onVisibility } from './platform';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YaGames?: { init(): Promise<any> };
  }
}

const PRODUCT_IDS: ProductId[] = ['no_ads', 'x2_forever', 'cash_pack', 'god_pet'];
// расходуемые покупки: их списывают сразу после выдачи
const CONSUMABLE = ['cash_pack', 'god_pet'];
// Технические имена лидербордов. Их нужно создать в консоли Яндекс Игр (см. docs/yandex-publish.md).
export const LEADERBOARD_NAMES: Record<Board, string> = { week: 'shawarmaWeek', total: 'shawarmaTotal' };

function loadScript(src: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => resolve(false), timeoutMs);
    s.src = src;
    s.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    s.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(s);
  });
}

// Возвращает платформу Яндекса или null, если игра запущена не на Яндекс Играх.
export async function createYandexPlatform(): Promise<Platform | null> {
  if (!window.YaGames && !(await loadScript('/sdk.js', 5000))) return null;
  if (!window.YaGames) return null;

  let ysdk: any;
  try {
    ysdk = await window.YaGames.init();
  } catch {
    return null;
  }

  let player: any = null;
  try {
    player = await ysdk.getPlayer({ scopes: false });
  } catch {
    player = null;
  }

  let payments: any = null;
  try {
    payments = ysdk.payments ?? (await ysdk.getPayments({ signed: false }));
  } catch {
    payments = null;
  }

  const pauseListeners: ((paused: boolean, reason: PauseReason) => void)[] = [];
  const emitPause = (p: boolean) => pauseListeners.forEach((cb) => cb(p, 'platform'));
  try {
    ysdk.on?.('game_api_pause', () => emitPause(true));
    ysdk.on?.('game_api_resume', () => emitPause(false));
  } catch {
    // старые версии SDK без событий — хватит visibilitychange
  }

  const authorized = () => {
    if (!player) return false;
    try {
      if (typeof player.isAuthorized === 'function') return !!player.isAuthorized();
      return player.getMode?.() !== 'lite';
    } catch {
      return false;
    }
  };
  // новый SDK: ysdk.leaderboards; старый: ysdk.getLeaderboards()
  let boards: any = null;
  const getBoards = async () => {
    if (ysdk.leaderboards) return ysdk.leaderboards;
    if (!boards && ysdk.getLeaderboards) boards = await ysdk.getLeaderboards();
    return boards;
  };
  const myId = () => {
    try {
      return player?.getUniqueID?.() ?? '';
    } catch {
      return '';
    }
  };

  async function consumeCash(purchases: any[], id = 'cash_pack'): Promise<number> {
    let count = 0;
    for (const p of purchases) {
      if (p.productID !== id) continue;
      try {
        await payments.consumePurchase(p.purchaseToken);
        count++;
      } catch {
        // не получилось списать — выдадим при следующем запуске
      }
    }
    return count;
  }

  return {
    name: 'yandex',
    lang: ysdk.environment?.i18n?.lang ?? 'ru',
    ready() {
      ysdk.features?.LoadingAPI?.ready?.();
    },
    gameplayStart() {
      ysdk.features?.GameplayAPI?.start?.();
    },
    gameplayStop() {
      ysdk.features?.GameplayAPI?.stop?.();
    },
    async load() {
      const local = localLoad() as { lastSeen?: number } | null;
      if (!player) return local;
      try {
        const data = await player.getData(['save']);
        const cloud = data?.save ?? null;
        // берём более свежее из облака и локального сохранения
        if (cloud && local) return (cloud.lastSeen ?? 0) >= (local.lastSeen ?? 0) ? cloud : local;
        return cloud ?? local;
      } catch {
        return local;
      }
    },
    async save(data) {
      localSave(data);
      if (!player) return;
      try {
        await player.setData({ save: data }, false);
      } catch {
        // облако недоступно — осталась локальная копия
      }
    },
    showRewarded() {
      return new Promise((resolve) => {
        let rewarded = false;
        try {
          ysdk.adv.showRewardedVideo({
            callbacks: {
              onRewarded: () => {
                rewarded = true;
              },
              onClose: () => resolve(rewarded),
              onError: () => resolve(false),
            },
          });
        } catch {
          resolve(false);
        }
      });
    },
    showInterstitial() {
      return new Promise((resolve) => {
        try {
          ysdk.adv.showFullscreenAdv({
            callbacks: { onClose: () => resolve(), onError: () => resolve() },
          });
        } catch {
          resolve();
        }
      });
    },
    purchasesAvailable: !!payments,
    async getProducts() {
      if (!payments) return [];
      try {
        const catalog: any[] = await payments.getCatalog();
        return catalog
          .filter((p) => PRODUCT_IDS.includes(p.id))
          .map((p): Product => ({ id: p.id, price: p.price ?? `${p.priceValue} ${p.priceCurrencyCode}` }));
      } catch {
        return [];
      }
    },
    async purchase(id) {
      if (!payments) return false;
      try {
        const p = await payments.purchase({ id });
        if (CONSUMABLE.includes(id)) await consumeCash([p], id);
        return true;
      } catch {
        return false;
      }
    },
    async restorePurchases() {
      if (!payments) return { owned: [], pendingCash: 0, pendingGods: 0 };
      try {
        const list: any[] = await payments.getPurchases();
        const owned = list.map((p) => p.productID).filter((id: string) => id === 'no_ads' || id === 'x2_forever');
        const pendingCash = await consumeCash(list);
        const pendingGods = await consumeCash(list, 'god_pet');
        return { owned, pendingCash, pendingGods };
      } catch {
        return { owned: [], pendingCash: 0, pendingGods: 0 };
      }
    },
    onPause(cb) {
      pauseListeners.push(cb);
      onVisibility(cb);
    },
    leaderboards: !!(ysdk.leaderboards || ysdk.getLeaderboards),
    isAuthorized: authorized,
    async login() {
      if (authorized()) return true;
      try {
        await ysdk.auth.openAuthDialog();
        player = await ysdk.getPlayer({ scopes: false });
      } catch {
        // игрок закрыл окно входа
      }
      return authorized();
    },
    async setScore(board, score) {
      if (!authorized()) return;
      try {
        const lb = await getBoards();
        const name = LEADERBOARD_NAMES[board];
        if (lb?.setScore) await lb.setScore(name, Math.floor(score));
        else await lb?.setLeaderboardScore?.(name, Math.floor(score));
      } catch {
        // не чаще раза в секунду и только для вошедших — ошибки молча пропускаем
      }
    },
    async getBoard(board) {
      try {
        const lb = await getBoards();
        if (!lb) return null;
        const name = LEADERBOARD_NAMES[board];
        const opts = { quantityTop: 10, includeUser: authorized(), quantityAround: 2 };
        const res = lb.getEntries ? await lb.getEntries(name, opts) : await lb.getLeaderboardEntries(name, opts);
        const me = myId();
        const entries: LbEntry[] = (res?.entries ?? []).map((e: any) => ({
          rank: Number(e.rank) || 0,
          name: String(e.player?.publicName ?? ''),
          score: Number(e.score) || 0,
          me: !!me && e.player?.uniqueID === me,
        }));
        return { entries, me: entries.find((e) => e.me) ?? null };
      } catch {
        return null;
      }
    },
  };
}
