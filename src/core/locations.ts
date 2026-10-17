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
  { id: 'metro', threshold: 0, mult: 1, body: 0xe4472b, roof: 0xffb02e, width: 200 },
  { id: 'beach', threshold: 20_000_000, mult: 3, body: 0x2fa7b8, roof: 0xe9c46a, width: 230 },
  { id: 'jungle', threshold: 30_000_000_000, mult: 10, body: 0x8a5a33, roof: 0x5e9c3a, width: 260 },
  { id: 'desert', threshold: 500_000_000_000, mult: 30, body: 0xd98b4a, roof: 0xfff4dc, width: 290 },
  { id: 'piazza', threshold: 5_000_000_000_000, mult: 100, body: 0xc8553d, roof: 0x2f6b4f, width: 320 },
];
