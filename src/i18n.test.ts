// Проверка словаря: каждый ключ есть на обоих языках, подстановки совпадают,
// а ключи, которые код собирает на ходу (`br_${id}` и т. п.), действительно существуют.
import { describe, expect, it } from 'vitest';
import { DICTS } from './i18n';
import { ACHIEVEMENTS } from './core/achievements';
import { UPGRADES } from './core/upgrades';
import { BRAINROTS } from './core/brainrots';
import { LOCATIONS } from './core/locations';
import { RARITIES } from './core/pets';
import { KINDS } from './core/quests';

const { ru, en } = DICTS;
const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');

// исходники игры как текст (Vite собирает их сам, без node:fs)
const SOURCES = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('словарь', () => {
  it('одинаковые ключи на русском и английском, без пустых строк', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
    for (const [k, v] of Object.entries(ru)) expect(v.trim(), `ru.${k}`).not.toBe('');
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en.${k}`).not.toBe('');
  });

  it('подстановки {v}, {n}… совпадают в обоих языках', () => {
    for (const k of Object.keys(ru)) expect(holes(en[k]), k).toBe(holes(ru[k]));
  });

  it('ключи, собранные из id, существуют', () => {
    const need = [
      ...ACHIEVEMENTS.flatMap((a) => [`ach_${a.id}`, `achd_${a.id}`]),
      ...UPGRADES.map((u) => `up_${u.id}`),
      ...BRAINROTS.map((b) => `br_${b.id}`),
      ...BRAINROTS.filter((b) => b.role === 'customer').map((b) => `brs_${b.id}`),
      ...LOCATIONS.flatMap((l) => [`loc_${l.id}`, `locd_${l.id}`]),
      ...RARITIES.map((r) => `rar_${r}`),
      ...KINDS.map((q) => `q_${q}`),
      ...[1, 2].flatMap((m) => [`mut_${m}`, `mutShort_${m}`]),
      ...Array.from({ length: 11 }, (_, i) => `num_${i + 1}`),
      ...Array.from({ length: 5 }, (_, i) => `loadTip${i + 1}`),
    ];
    const missing = need.filter((k) => !(k in ru) || !(k in en));
    expect(missing).toEqual([]);
  });

  it('ключи из t(\'…\') в коде существуют', () => {
    const missing: string[] = [];
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    for (const [file, code] of Object.entries(SOURCES)) {
      for (const m of code.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'/g)) if (!(m[1] in ru)) missing.push(`${file}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
});
