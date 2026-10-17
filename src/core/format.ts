// Короткая запись больших чисел: 1,2 тыс. / 3,4 млн и 1.2K / 3.4M.

const SUFFIX = {
  ru: ['', ' тыс.', ' млн', ' млрд', ' трлн', ' квдр.', ' квнт.'],
  en: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'],
};

export function formatNumber(n: number, lang: 'ru' | 'en'): string {
  if (!Number.isFinite(n)) return '∞';
  const sign = n < 0 ? '-' : '';
  let v = Math.abs(n);
  if (v < 1000) {
    // мелкие доходы вроде 0,2 ₽/сек показываем с одной цифрой после запятой
    const r = v < 100 && v % 1 !== 0 ? (Math.floor(v * 10) / 10).toString() : String(Math.floor(v));
    return sign + (lang === 'ru' ? r.replace('.', ',') : r);
  }
  let i = 0;
  while (v >= 1000 && i < SUFFIX[lang].length - 1) {
    v /= 1000;
    i++;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  let s = (Math.floor(v * 10 ** digits) / 10 ** digits).toFixed(digits);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  if (lang === 'ru') s = s.replace('.', ',');
  return sign + s + SUFFIX[lang][i];
}

export function formatDuration(seconds: number, lang: 'ru' | 'en'): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return lang === 'ru' ? `${h} ч ${m % 60} мин` : `${h}h ${m % 60}m`;
  }
  return `${m}:${String(r).padStart(2, '0')}`;
}
