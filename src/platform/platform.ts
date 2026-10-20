// Слой-адаптер площадки. Игра обращается к Яндексу, VK или браузеру только через этот интерфейс.

export type ProductId = 'no_ads' | 'x2_forever' | 'cash_pack' | 'god_pet';

export interface Product {
  id: ProductId;
  price: string; // строка цены от площадки, например «49 YAN»
}

// Лидерборды: недельный и за всё время. Счёт — проданная шаурма.
export type Board = 'week' | 'total';
export interface LbEntry {
  rank: number;
  name: string;
  score: number;
  me: boolean;
}
export interface LbResult {
  entries: LbEntry[];
  me: LbEntry | null;
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
  restorePurchases(): Promise<{ owned: ProductId[]; pendingCash: number; pendingGods: number }>;
  // площадка просит поставить игру на паузу (реклама, свёрнутая вкладка)
  // reason: 'hidden' — вкладка свёрнута, 'platform' — пауза по событию площадки
  onPause(cb: (paused: boolean, reason: PauseReason) => void): void;
  // есть ли таблицы игроков (только на Яндекс Играх)
  leaderboards: boolean;
  // вошёл ли игрок в Яндекс ID: записывать результат могут только вошедшие
  isAuthorized(): boolean;
  // окно входа; вызывать только по нажатию игрока (п. 1.2.1 требований Яндекса)
  login(): Promise<boolean>;
  setScore(board: Board, score: number): Promise<void>;
  // лучшие игроки и соседи игрока; null, если таблица недоступна
  getBoard(board: Board): Promise<LbResult | null>;
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

export type PauseReason = 'hidden' | 'platform';

export function onVisibility(cb: (paused: boolean, reason: PauseReason) => void) {
  document.addEventListener('visibilitychange', () => cb(document.hidden, 'hidden'));
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
      return { owned: [], pendingCash: 0, pendingGods: 0 };
    },
    onPause: onVisibility,
    leaderboards: false,
    isAuthorized() {
      return false;
    },
    async login() {
      return false;
    },
    async setScore() {},
    async getBoard() {
      return null;
    },
  };
}

export { localLoad, localSave };
