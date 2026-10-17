// Слой-адаптер площадки. Игра обращается к Яндексу, VK или браузеру только через этот интерфейс.

export type ProductId = 'no_ads' | 'x2_forever' | 'cash_pack';

export interface Product {
  id: ProductId;
  price: string; // строка цены от площадки, например «49 YAN»
}

export interface Platform {
  name: 'local' | 'yandex';
  lang: string;
  // сообщить площадке, что игра загрузилась и можно играть
  ready(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  load(): Promise<unknown | null>;
  save(data: unknown): Promise<void>;
  // true, если игрок досмотрел рекламу и заслужил награду
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
  purchasesAvailable: boolean;
  getProducts(): Promise<Product[]>;
  // true, если покупка прошла
  purchase(id: ProductId): Promise<boolean>;
  // разовые покупки, которые игрок уже сделал (например no_ads), и не выданные пакеты денег
  restorePurchases(): Promise<{ owned: ProductId[]; pendingCash: number }>;
  // площадка просит поставить игру на паузу (реклама, свёрнутая вкладка)
  onPause(cb: (paused: boolean) => void): void;
}

const KEY = 'shawarma-idle-save';

function localLoad(): unknown | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function localSave(data: unknown) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // хранилище недоступно (приватный режим) — игра просто не сохранится
  }
}

function onVisibility(cb: (paused: boolean) => void) {
  document.addEventListener('visibilitychange', () => cb(document.hidden));
}

// Версия для браузера и разработки: сохранение в localStorage, реклама «показывается» мгновенно.
export function createLocalPlatform(): Platform {
  return {
    name: 'local',
    lang: navigator.language?.slice(0, 2) ?? 'ru',
    ready() {},
    gameplayStart() {},
    gameplayStop() {},
    async load() {
      return localLoad();
    },
    async save(data) {
      localSave(data);
    },
    async showRewarded() {
      return true;
    },
    async showInterstitial() {},
    purchasesAvailable: false,
    async getProducts() {
      return [];
    },
    async purchase() {
      return false;
    },
    async restorePurchases() {
      return { owned: [], pendingCash: 0 };
    },
    onPause: onVisibility,
  };
}

export { localLoad, localSave, onVisibility };
