// Запись очков игрока в таблицу игроков VK. Игра шлёт сюда свои параметры запуска (с подписью VK)
// и число проданной шаурмы; сервер проверяет подпись и вызывает secure.addAppEvent сервисным ключом.

import { CORS, checkLaunch } from './_vk';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request): Promise<Response> {
  let body: { launch?: string; score?: number };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'bad json' }, 400);
  }
  const secret = process.env.VK_APP_SECRET ?? '';
  const token = process.env.VK_SERVICE_TOKEN ?? '';
  const user = checkLaunch(String(body.launch ?? ''), secret);
  const score = Math.floor(Number(body.score));
  if (!user) return json({ ok: false, error: 'bad sign' }, 403);
  if (!Number.isFinite(score) || score < 0) return json({ ok: false, error: 'bad score' }, 400);
  if (!token) return json({ ok: false, error: 'no token' }, 500);
  const q = new URLSearchParams({
    user_id: user,
    activity_id: '2', // 2 — очки (таблица «по очкам» в настройках приложения)
    value: String(Math.min(score, 2_000_000_000)),
    access_token: token,
    client_secret: secret,
    v: '5.199',
  });
  const r = await fetch(`https://api.vk.com/method/secure.addAppEvent?${q}`);
  const data = (await r.json().catch(() => ({}))) as { error?: { error_msg?: string } };
  return data.error ? json({ ok: false, error: data.error.error_msg ?? 'vk error' }, 502) : json({ ok: true });
}
