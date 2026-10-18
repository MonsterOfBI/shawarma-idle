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

// Сюжет: от коробки у помойки до дворца шаурмы, пять точек. Каждая богаче предыдущей.
// В версии 2.8 пляж и джунгли убраны из сюжета, а их персонажи разошлись по оставшимся точкам.
export const LOCATIONS: LocationDef[] = [
  { id: 'dump', threshold: 0, mult: 1, body: 0xc49a62, roof: 0x3d6fb6, width: 170 },
  { id: 'metro', threshold: 600_000_000_000, mult: 4, body: 0xe4472b, roof: 0xffb02e, width: 200 },
  { id: 'desert', threshold: 22_000_000_000_000, mult: 25, body: 0xd98b4a, roof: 0xfff4dc, width: 260 },
  { id: 'piazza', threshold: 380_000_000_000_000, mult: 150, body: 0xc8553d, roof: 0x2f6b4f, width: 300 },
  { id: 'palace', threshold: 5_000_000_000_000_000, mult: 1000, body: 0xf6e7c1, roof: 0xffcf3f, width: 340 },
];

// Сохранения версии 7 жили на семи точках: переводим номер точки на новую карту из пяти.
export const LOCATION_FROM_V7 = [0, 1, 1, 2, 2, 3, 4];
