import '@fontsource/unbounded/cyrillic-700.css';
import '@fontsource/unbounded/cyrillic-800.css';
import '@fontsource/unbounded/cyrillic-900.css';
import '@fontsource/unbounded/latin-700.css';
import '@fontsource/unbounded/latin-800.css';
import '@fontsource/unbounded/latin-900.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/cyrillic-600.css';
import '@fontsource/golos-text/cyrillic-700.css';
import '@fontsource/golos-text/latin-500.css';
import '@fontsource/golos-text/latin-600.css';
import '@fontsource/golos-text/latin-700.css';
import './style.css';
import { Game } from './game';
import { setLang } from './i18n';
import { createLocalPlatform } from './platform/platform';
import { createYandexPlatform } from './platform/yandex';

// Требования Яндекс Игр: без контекстного меню, выделения и перетаскивания картинок (долгий тап на телефоне).
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());

async function start() {
  // На Яндекс Играх подключится их SDK, в браузере — локальная версия без рекламы и покупок.
  const platform = (await createYandexPlatform()) ?? createLocalPlatform();
  const save = await platform.load();
  // язык, выбранный в настройках, важнее языка площадки
  const pref = (save as { langPref?: string } | null)?.langPref;
  setLang(pref === 'ru' || pref === 'en' ? pref : platform.lang);
  // шрифты лежат в сборке; ждём их, чтобы надписи в сцене сразу были нужным шрифтом
  await Promise.race([
    Promise.all(['800 20px Unbounded', '900 20px Unbounded', '700 20px Unbounded', '600 16px "Golos Text"'].map((f) => document.fonts.load(f, 'ШАУРМА 123'))),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => undefined);
  await new Game(platform).start(save);
}

void start();
