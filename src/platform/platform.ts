// Слой-адаптер площадки. Сейчас только локальное сохранение в браузере;
// позже сюда добавятся реализации для Яндекс Игр (SDK) и VK Games (VK Bridge):
// реклама, покупки, облачные сохранения и язык игрока.

import type { GameState } from '../core/economy';

export interface Platform {
  load(): Promise<GameState | null>;
  save(state: GameState): Promise<void>;
}

const KEY = 'shawarma-idle-save';

export const localPlatform: Platform = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as GameState) : null;
    } catch {
      return null;
    }
  },
  async save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // хранилище недоступно (приватный режим) — игра просто не сохранится
    }
  },
};
