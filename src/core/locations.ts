// Локации для переезда (престижа). Названия — в словаре по id.

export interface LocationDef {
  id: string;
  // сколько нужно заработать на предыдущей локации, чтобы переехать сюда
  threshold: number;
  // постоянный множитель всего дохода на этой локации
  mult: number;
  // цвета ларька для минималистичной графики
  body: number;
  roof: number;
  width: number;
}

export const LOCATIONS: LocationDef[] = [
  { id: 'metro', threshold: 0, mult: 1, body: 0xe2583e, roof: 0xf2b134, width: 200 },
  { id: 'market', threshold: 20_000_000, mult: 3, body: 0x2f9e6b, roof: 0xf2e3b3, width: 240 },
  { id: 'shop', threshold: 30_000_000_000, mult: 10, body: 0x3d6fb6, roof: 0xf2b134, width: 280 },
  { id: 'cafe', threshold: 500_000_000_000, mult: 30, body: 0x8a4fbf, roof: 0xf4ede4, width: 320 },
  { id: 'chain', threshold: 5_000_000_000_000, mult: 100, body: 0x2b2a35, roof: 0xe2583e, width: 360 },
];
