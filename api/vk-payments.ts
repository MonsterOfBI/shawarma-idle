// Адрес для уведомлений о платежах VK: https://shawarma-idle.vercel.app/api/vk-payments
// Его вписывают в настройках приложения VK, раздел «Платежи» (см. docs/vk-publish.md).

import { handlePayment } from './_vk';

export async function POST(req: Request): Promise<Response> {
  const body = new URLSearchParams(await req.text());
  const params = Object.fromEntries(body.entries());
  const answer = handlePayment(params, process.env.VK_APP_SECRET ?? '');
  return new Response(JSON.stringify(answer), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
