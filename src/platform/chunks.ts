// Хранилище VK (VKWebAppStorageSet) держит не больше 4096 байт на ключ,
// поэтому сохранение режем на куски. 1000 символов — максимум 4000 байт в UTF-8.
export const CHUNK_CHARS = 1000;

export function splitSave(json: string, size = CHUNK_CHARS): string[] {
  const parts: string[] = [];
  for (let i = 0; i < json.length; i += size) parts.push(json.slice(i, i + size));
  return parts.length ? parts : [''];
}

// Собирает куски обратно; null, если чего-то не хватает или JSON битый.
export function joinSave(count: number, values: Record<string, string>, key: (i: number) => string): unknown | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  let json = '';
  for (let i = 0; i < count; i++) {
    const v = values[key(i)];
    if (v === undefined) return null;
    json += v;
  }
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Из параметров запуска VK (?vk_app_id=…&vk_language=…&sign=…). null — игра открыта не в VK.
export function vkLaunch(search: string): { appId: string; lang: string } | null {
  const q = new URLSearchParams(search);
  const appId = q.get('vk_app_id');
  if (!appId || !q.get('sign')) return null;
  return { appId, lang: q.get('vk_language') ?? 'ru' };
}

// «7 голосов», «1 голос», «22 голоса» — цена товара в VK.
export function votesText(n: number, l: 'ru' | 'en'): string {
  if (l === 'en') return `${n} ${n === 1 ? 'vote' : 'votes'}`;
  const d = n % 10, h = n % 100;
  const w = d === 1 && h !== 11 ? 'голос' : d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'голоса' : 'голосов';
  return `${n} ${w}`;
}
