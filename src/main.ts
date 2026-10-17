import './style.css';
import { Game } from './game';
import { setLang } from './i18n';
import { createLocalPlatform } from './platform/platform';
import { createYandexPlatform } from './platform/yandex';

async function start() {
  // На Яндекс Играх подключится их SDK, в браузере — локальная версия без рекламы и покупок.
  const platform = (await createYandexPlatform()) ?? createLocalPlatform();
  setLang(platform.lang);
  await new Game(platform).start();
}

void start();
