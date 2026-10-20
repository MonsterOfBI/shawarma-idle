// Общая логика серверных функций для VK (Vercel Functions, папка api/).
// Файлы с подчёркиванием Vercel не превращает в адреса, это просто модуль.
//
// Секреты не хранятся в коде, их задают в настройках проекта Vercel (Environment Variables):
//   VK_APP_SECRET    — «Защищённый ключ» приложения VK (подписи заказов и параметров запуска);
//   VK_SERVICE_TOKEN — «Сервисный ключ доступа» приложения VK (запись очков в таблицу игроков).

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Товары за голоса (1 голос = 7 ₽). Идентификаторы те же, что на Яндексе.
export const VK_ITEMS: Record<string, { title: string; votes: number }> = {
  starter_pack: { title: 'Стартовый набор', votes: 7 },
  no_ads: { title: 'Без рекламы', votes: 14 },
  x2_forever: { title: 'Доход ×2 навсегда', votes: 21 },
  cash_pack: { title: 'Мешок денег', votes: 4 },
  god_pet: { title: 'Брейнрот-бог', votes: 21 },
};

function sameText(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Подпись уведомления о платеже: md5 от «ключ=значение» по алфавиту (без sig) плюс секрет.
export function paymentSig(params: Record<string, string>, secret: string): string {
  const line = Object.keys(params)
    .filter((k) => k !== 'sig')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('');
  return createHash('md5').update(line + secret, 'utf8').digest('hex');
}

// Ответ на уведомление VK о платеже (get_item, order_status_change и их _test-версии).
export function handlePayment(params: Record<string, string>, secret: string): unknown {
  if (!secret || !params.sig || !sameText(paymentSig(params, secret), params.sig)) {
    return { error: { error_code: 10, error_msg: 'Несовпадение вычисленной и переданной подписи запроса.', critical: true } };
  }
  const type = (params.notification_type ?? '').replace(/_test$/, '');
  if (type === 'get_item') {
    const item = VK_ITEMS[params.item];
    if (!item) return { error: { error_code: 20, error_msg: 'Товара не существует.', critical: true } };
    return { response: { item_id: params.item, title: item.title, price: item.votes, expiration: 3600 } };
  }
  if (type === 'order_status_change') {
    if (params.status !== 'chargeable') return { error: { error_code: 100, error_msg: 'Передано непонятно что вместо chargeable.', critical: true } };
    const id = Number(params.order_id);
    return { response: { order_id: id, app_order_id: id } };
  }
  return { error: { error_code: 100, error_msg: 'Неизвестный тип уведомления.', critical: true } };
}

// Проверка параметров запуска мини-приложения (?vk_user_id=…&sign=…): HMAC-SHA256 от vk_*-параметров
// по алфавиту, в base64url без «=». Возвращает id игрока или null, если подпись не сходится.
export function checkLaunch(search: string, secret: string): string | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sign = q.get('sign');
  const user = q.get('vk_user_id');
  if (!secret || !sign || !user) return null;
  const vk = [...q.entries()].filter(([k]) => k.startsWith('vk_')).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const line = new URLSearchParams(vk).toString();
  const want = createHmac('sha256', secret).update(line).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return sameText(want, sign) ? user : null;
}

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
