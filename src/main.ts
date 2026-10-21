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
import { setLang, t } from './i18n';
import { createLocalPlatform } from './platform/platform';
import { createVkPlatform } from './platform/vk';
import { createYandexPlatform } from './platform/yandex';

// Требования Яндекс Игр: без контекстного меню, выделения и перетаскивания картинок (долгий тап на телефоне).
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());
document.addEventListener('selectstart', (e) => e.preventDefault());

// Высота страницы — по видимой части экрана. В Safari на iPhone 100 % считается с учётом спрятанной
// панели браузера, и нижнее меню уезжало под неё (VK в мобильном Safari).
function fitHeight() {
  let h = window.visualViewport?.height ?? window.innerHeight;
  // VK в мобильном браузере сообщает, сколько экрана на самом деле видно (см. platform/vk.ts).
  const vk = (window as { vkMaxHeight?: number }).vkMaxHeight;
  if (vk && vk < h) h = vk;
  document.documentElement.style.setProperty('--vh', `${Math.round(h)}px`);
  window.scrollTo(0, 0);
}
fitHeight();
window.addEventListener('resize', fitHeight);
window.visualViewport?.addEventListener('resize', fitHeight);
window.addEventListener('orientationchange', () => setTimeout(fitHeight, 300));

// Полоска загрузки: двигаем по шагам запуска, чтобы игрок видел, что игра не зависла.
export function loadProgress(p: number) {
  document.querySelector<HTMLElement>('.loading-bar i')?.style.setProperty('--p', `${p}%`);
}

async function start() {
  loadProgress(20);
  // Во ВКонтакте (в адресе есть vk_app_id) — VK Bridge, на Яндекс Играх — их SDK,
  // в браузере — локальная версия без рекламы и покупок.
  const platform = (await createVkPlatform()) ?? (await createYandexPlatform()) ?? createLocalPlatform();
  const save = await platform.load();
  // язык, выбранный в настройках, важнее языка площадки
  const pref = (save as { langPref?: string } | null)?.langPref;
  setLang(pref === 'ru' || pref === 'en' ? pref : platform.lang);
  loadProgress(55);
  const tip = document.querySelector('.loading-tip');
  if (tip) tip.textContent = t(`loadTip${1 + Math.floor(Math.random() * 5)}`);
  const title = document.querySelector('.loading-title');
  if (title) title.textContent = t('title');
  // шрифты лежат в сборке; ждём их, чтобы надписи в сцене сразу были нужным шрифтом
  await Promise.race([
    Promise.all(['800 20px Unbounded', '900 20px Unbounded', '700 20px Unbounded', '600 16px "Golos Text"'].map((f) => document.fonts.load(f, 'ШАУРМА SHAWARMA 123'))),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => undefined);
  loadProgress(75);
  await new Game(platform).start(save);
}

void start();
