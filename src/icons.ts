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
  barker: svg(`<path d="M14 12 L26 6 v20 L14 20 Z" fill="${A}"/><rect x="6" y="12" width="8" height="8" rx="2" fill="${T}"/><path d="M9 20 l2 6"/><path d="M28 11 q2 5 0 10"/>`),
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
  // награды версии 2.18
  met: svg(`<circle cx="11" cy="13" r="5" fill="${C}"/><circle cx="22" cy="13" r="5" fill="${A}"/><path d="M3 27 a8 8 0 0 1 16 0 Z" fill="${C}"/><path d="M14 27 a8 8 0 0 1 16 0 Z" fill="${A}"/>`),
  pets: svg(`<ellipse cx="16" cy="21" rx="7" ry="6" fill="${A}"/><circle cx="8" cy="12" r="3" fill="${A}"/><circle cx="13" cy="7" r="3" fill="${A}"/><circle cx="19" cy="7" r="3" fill="${A}"/><circle cx="24" cy="12" r="3" fill="${A}"/>`),
  mut: svg(`<path d="M16 4 L27 13 L16 28 L5 13 Z" fill="#8ad7ff"/><path d="M5 13 h22 M11 13 l5 15 5-15 M11 13 l5-9 5 9"/>`),
  boxes: svg(`<rect x="3" y="15" width="13" height="12" rx="1.5" fill="#c8813a"/><rect x="16" y="15" width="13" height="12" rx="1.5" fill="#c8813a"/><rect x="9" y="4" width="14" height="11" rx="1.5" fill="${A}"/><path d="M3 21 h13 M16 21 h13 M9 9.5 h14"/>`),
  legend: svg(`<path d="M5 24 L7 9 l5 6 4-9 4 9 5-6 2 15 Z" fill="${A}"/><circle cx="16" cy="19" r="2.5" fill="${T}"/><path d="M5 27 h22"/>`),
  star3: svg(`<path d="M16 3 l2.4 5 5.4.8 -3.9 3.8 .9 5.4 -4.8-2.6 -4.8 2.6 .9-5.4 -3.9-3.8 5.4-.8 Z" fill="${A}"/><path d="M8 16 l1.7 3.5 3.8.6 -2.8 2.6 .7 3.8 -3.4-1.8 -3.4 1.8 .7-3.8 -2.8-2.6 3.8-.6 Z" fill="${A}"/><path d="M24 16 l1.7 3.5 3.8.6 -2.8 2.6 .7 3.8 -3.4-1.8 -3.4 1.8 .7-3.8 -2.8-2.6 3.8-.6 Z" fill="${A}"/>`),
  god: svg(`<ellipse cx="16" cy="7" rx="8" ry="3" stroke="${A}" stroke-width="3"/><circle cx="16" cy="19" r="8" fill="${C}"/><path d="M12 18 h.1 M20 18 h.1" stroke-width="3"/><path d="M12 22 q4 3 8 0"/>`),
  // интерфейс
  coin: svg(`<circle cx="16" cy="16" r="12" fill="${A}"/><circle cx="16" cy="16" r="8" fill="#ffd86b" stroke="#c98a12"/><path d="M16 11 v10 M13 13.5 h5" stroke="#c98a12"/>`),
  bolt: svg(`<path d="M18 3 L7 18 h8 l-2 11 L25 13 h-8 Z" fill="${A}"/>`),
  finger: svg(`<path d="M12 27 v-11 a2 2 0 0 1 4 0 v-7 a2 2 0 0 1 4 0 v12 l3-2 a2 2 0 0 1 3 3 l-5 7 Z" fill="${C}"/>`),
  gift: svg(`<rect x="5" y="13" width="22" height="14" rx="2" fill="${T}"/><rect x="3" y="9" width="26" height="6" rx="2" fill="${T}"/><path d="M16 9 v18" stroke="${A}" stroke-width="4"/><path d="M16 9 c-4-6-10-3-6 0 Z M16 9 c4-6 10-3 6 0 Z" fill="${A}"/>`),
  list: svg(`<rect x="6" y="5" width="20" height="23" rx="3" fill="${C}"/><rect x="11" y="3" width="10" height="5" rx="2" fill="${A}"/><path d="M10 14 l2 2 3-4 M10 21 l2 2 3-4 M18 14 h5 M18 21 h5"/>`),
  crate: svg(`<rect x="4" y="11" width="24" height="16" rx="2" fill="#c8813a"/><path d="M4 11 l3-5 h18 l3 5" fill="#e0a050"/><path d="M4 18 h24 M11 11 v16 M21 11 v16"/><rect x="13" y="15" width="6" height="5" rx="1" fill="${A}"/>`),
  goldcrate: svg(`<rect x="4" y="11" width="24" height="16" rx="2" fill="${A}"/><path d="M4 11 l3-5 h18 l3 5" fill="#ffd86b"/><path d="M4 18 h24 M11 11 v16 M21 11 v16"/><rect x="13" y="15" width="6" height="5" rx="1" fill="${T}"/>`),
  play: svg(`<circle cx="16" cy="16" r="12" fill="${P}"/><path d="M13 10 L23 16 L13 22 Z" fill="${A}" stroke="${A}"/>`),
  truck: svg(`<rect x="3" y="9" width="17" height="13" rx="1" fill="${T}"/><path d="M20 13 h5 l4 5 v4 h-9 Z" fill="${C}"/><circle cx="9" cy="24" r="3" fill="${C}"/><circle cx="24" cy="24" r="3" fill="${C}"/>`),
  bag: svg(`<path d="M6 11 h20 l-2 16 h-16 Z" fill="${A}"/><path d="M11 11 v-2 a5 5 0 0 1 10 0 v2"/>`),
  up: svg(`<circle cx="16" cy="16" r="12" fill="${G}"/><path d="M16 23 V10 M10 15 l6-6 6 6" stroke="${C}" stroke-width="3"/>`),
  gear: svg(`<circle cx="16" cy="16" r="11" stroke-width="5" stroke-dasharray="4.3 4.3" stroke-linecap="butt"/><circle cx="16" cy="16" r="8.5" fill="${C}"/><circle cx="16" cy="16" r="3.2" fill="${A}"/>`),
  music: svg(`<path d="M12 23 V8 l13-3 v15" /><circle cx="9" cy="23" r="3.5" fill="${C}"/><circle cx="22" cy="20" r="3.5" fill="${C}"/>`),
  sound: svg(`<path d="M5 12 h5 l7-6 v20 l-7-6 h-5 Z" fill="${C}"/><path d="M21 11 a6 6 0 0 1 0 10 M24 7 a11 11 0 0 1 0 18"/>`),
  mute: svg(`<path d="M5 12 h5 l7-6 v20 l-7-6 h-5 Z" fill="${C}"/><path d="M21 12 l7 8 M28 12 l-7 8"/>`),
  frenzy: svg(`<path d="M18 3 L7 18 h8 l-2 11 L25 13 h-8 Z" fill="${T}"/>`),
  trophy: svg(`<path d="M9 5 h14 v7 a7 7 0 0 1 -14 0 Z" fill="${A}"/><path d="M9 8 h-4 a4 4 0 0 0 5 6 M23 8 h4 a4 4 0 0 1 -5 6"/><path d="M16 19 v4"/><rect x="10" y="23" width="12" height="5" rx="1.5" fill="${T}"/>`),
  star: svg(`<path d="M16 4 l3.5 7.2 7.9 1.1 -5.7 5.5 1.4 7.8 -7.1-3.7 -7.1 3.7 1.4-7.8 -5.7-5.5 7.9-1.1 Z" fill="${A}"/>`),
  merge: svg(`<circle cx="8" cy="10" r="4" fill="${C}"/><circle cx="24" cy="10" r="4" fill="${C}"/><circle cx="16" cy="7" r="4" fill="${C}"/><path d="M9 15 L16 22 L23 15 M16 12 v10"/><path d="M16 22 l2.2 4.4 4.8.7 -3.5 3.3" fill="${A}"/>`),
  x2: svg(`<circle cx="16" cy="16" r="12" fill="${A}"/><path d="M10 12 l6 8 M16 12 l-6 8 M19 13 a3 3 0 0 1 6 1 c0 3-6 4-6 7 h6"/>`),
};

export function ui(id: string): string {
  return ICONS[id] ?? '';
}

export function icon(id: string): string {
  return ICONS[id] ?? ICONS.lock;
}

// Значок награды по её id: taps_100 → taps
export function awardIcon(id: string): string {
  return icon(id.split('_')[0]);
}
