// Маленькие значки улучшений и наград из простых фигур, в палитре игры.

const P = '#2a1b3d';
const T = '#e4472b';
const A = '#ffb02e';
const G = '#5e9c3a';
const C = '#fff4dc';
const M = '#b5651d';

const svg = (body: string) => `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="${P}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;

const ICONS: Record<string, string> = {
  knife: svg(`<path d="M5 22 L22 7 L25 10 L10 24 Z" fill="${C}"/><rect x="20" y="18" width="9" height="5" rx="2" transform="rotate(-42 24 20)" fill="${T}"/>`),
  grill_helper: svg(`<path d="M9 18 a5 5 0 0 1 2-9 a6 6 0 0 1 10 0 a5 5 0 0 1 2 9 Z" fill="${C}"/><rect x="10" y="18" width="12" height="7" fill="${C}"/>`),
  cashier: svg(`<rect x="6" y="14" width="20" height="12" rx="2" fill="${A}"/><rect x="9" y="7" width="14" height="7" fill="${C}"/><path d="M11 19 h10"/>`),
  lavash: svg(`<ellipse cx="16" cy="17" rx="11" ry="8" fill="${C}"/><path d="M9 15 q3 3 7 0 q3-3 7 0"/>`),
  second_spit: svg(`<path d="M7 7 h7 l-1.5 18 h-4 Z" fill="${M}"/><path d="M18 7 h7 l-1.5 18 h-4 Z" fill="${M}"/>`),
  sauce: svg(`<rect x="10" y="11" width="12" height="16" rx="3" fill="${T}"/><path d="M13 11 v-4 h6 v4"/><path d="M16 7 v-3"/>`),
  sign: svg(`<rect x="5" y="9" width="22" height="12" rx="2" fill="${P}"/><path d="M9 15 h14" stroke="${A}" stroke-width="3"/><path d="M11 21 v5 M21 21 v5"/>`),
  courier: svg(`<circle cx="9" cy="23" r="3.5" fill="${C}"/><circle cx="24" cy="23" r="3.5" fill="${C}"/><path d="M9 23 h11 l3-12 h3"/><rect x="6" y="11" width="9" height="8" fill="${A}"/>`),
  cheese: svg(`<path d="M5 22 L26 12 L26 24 L5 24 Z" fill="${A}"/><circle cx="14" cy="21" r="1.5"/><circle cx="21" cy="18" r="1.5"/>`),
  reviews: svg(`<path d="M16 5 l3.3 6.8 7.4 1 -5.4 5.2 1.3 7.4 -6.6-3.5 -6.6 3.5 1.3-7.4 -5.4-5.2 7.4-1 Z" fill="${A}"/>`),
  window: svg(`<rect x="5" y="7" width="22" height="18" rx="2" fill="${C}"/><path d="M5 18 h22"/><rect x="9" y="11" width="14" height="5" fill="${A}" stroke="none"/>`),
  double: svg(`<rect x="7" y="8" width="8" height="18" rx="3" fill="${C}" transform="rotate(-12 11 17)"/><rect x="17" y="8" width="8" height="18" rx="3" fill="${C}" transform="rotate(12 21 17)"/>`),
  night_shift: svg(`<path d="M21 5 a11 11 0 1 0 6 18 a9 9 0 0 1 -6 -18 Z" fill="${A}"/>`),
  cashback: svg(`<circle cx="16" cy="16" r="11" fill="${A}"/><path d="M11 21 L21 11"/><circle cx="12" cy="12" r="1.8"/><circle cx="20" cy="20" r="1.8"/>`),
  secret: svg(`<circle cx="11" cy="16" r="6" fill="${A}"/><path d="M17 16 h10 M23 16 v4 M26 16 v3"/>`),
  franchise: svg(`<path d="M5 15 L16 6 L27 15" /><rect x="8" y="15" width="16" height="11" fill="${C}"/><rect x="13" y="19" width="6" height="7" fill="${T}"/>`),
  meme_ads: svg(`<circle cx="16" cy="16" r="11" fill="${A}"/><circle cx="12" cy="13" r="1.5" fill="${P}"/><circle cx="20" cy="13" r="1.5" fill="${P}"/><path d="M10 18 q6 6 12 0"/>`),
  food_truck: svg(`<rect x="3" y="10" width="18" height="12" fill="${A}"/><path d="M21 13 h5 l3 4 v5 h-8 Z" fill="${C}"/><circle cx="9" cy="24" r="3" fill="${C}"/><circle cx="24" cy="24" r="3" fill="${C}"/>`),
  // награды
  taps: svg(`<path d="M12 27 v-11 a2 2 0 0 1 4 0 v-7 a2 2 0 0 1 4 0 v12 l3-2 a2 2 0 0 1 3 3 l-5 7 Z" fill="${C}"/>`),
  earn: svg(`<circle cx="13" cy="19" r="8" fill="${A}"/><circle cx="20" cy="13" r="8" fill="${A}"/><path d="M20 9 v8 M17 11 h5"/>`),
  staff: svg(`<circle cx="11" cy="11" r="4" fill="${C}"/><circle cx="21" cy="11" r="4" fill="${C}"/><path d="M4 26 a7 7 0 0 1 14 0 Z M14 26 a7 7 0 0 1 14 0 Z" fill="${G}"/>`),
  golden: svg(`<path d="M7 13 l4 4 5-9 5 9 4-4 -2 12 h-14 Z" fill="${A}"/>`),
  combo: svg(`<path d="M18 3 L7 18 h8 l-2 11 L25 13 h-8 Z" fill="${A}"/>`),
  move: svg(`<path d="M4 20 L16 9 L28 20" /><rect x="8" y="20" width="16" height="7" fill="${T}"/><path d="M16 3 v6"/>`),
  lock: svg(`<rect x="8" y="14" width="16" height="12" rx="2" fill="${C}"/><path d="M11 14 v-3 a5 5 0 0 1 10 0 v3"/>`),
};

export function icon(id: string): string {
  return ICONS[id] ?? ICONS.lock;
}

// Значок награды по её id: taps_100 → taps
export function awardIcon(id: string): string {
  return icon(id.split('_')[0]);
}
