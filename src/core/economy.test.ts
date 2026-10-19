import { describe, expect, it } from 'vitest';
import {
  type GameState,
  OFFLINE_CAP_SECONDS,
  addBoost,
  buy,
  canBuy,
  canRelocate,
  nextMove,
  collectOffline,
  incomePerSecond,
  isMaxed,
  newGame,
  normalize,
  offlineEarnings,
  relocate,
  tap,
  tapValue,
  tick,
  catchGolden,
  comboMult,
  goldenReward,
  recordCombo,
} from './economy';
import { ACHIEVEMENTS, achievementMult, unlockAchievements } from './achievements';
import { BOX_ODDS, PET_RARITY } from './pets';
import { BRAINROTS, averagePay, customerPool, meet, payOf, pickCustomer } from './brainrots';
import { CRIT_CHANCE, CRIT_MULT, bulkAmount, bulkCost, buyN, canBuyN, customerCheck, isCrit, maxAffordable, serveCustomer, serveIntervalMs } from './economy';
import { UPGRADE_BY_ID } from './upgrades';
import { formatNumber } from './format';
import { LOCATIONS } from './locations';
import { secondsToEarn } from './sim';
import { UPGRADES, upgradeCost } from './upgrades';

describe('экономика', () => {
  it('тап даёт 1 ₽ в начале игры', () => {
    expect(tap(newGame(0), 0).money).toBe(1);
  });

  it('нож увеличивает доход с тапа', () => {
    const s = buy({ ...newGame(0), money: 100 }, 'knife');
    expect(tapValue(s, 0)).toBe(2);
  });

  it('нельзя купить без денег', () => {
    const s = newGame(0);
    expect(canBuy(s, 'grill_helper')).toBe(false);
    expect(buy(s, 'grill_helper')).toBe(s);
  });

  it('множитель покупается один раз', () => {
    let s = buy({ ...newGame(0), money: 1e9 }, 'sign');
    expect(canBuy(s, 'sign')).toBe(false);
    s = buy(s, 'sign');
    expect(s.levels.sign).toBe(1);
  });

  it('цены растут и остаются конечными', () => {
    for (const u of UPGRADES) {
      expect(upgradeCost(u, 1)).toBeGreaterThan(upgradeCost(u, 0));
      expect(Number.isFinite(upgradeCost(u, Math.min(500, u.maxLevel ?? 500)))).toBe(true);
    }
  });

  it('у всех улучшений разные id', () => {
    expect(new Set(UPGRADES.map((u) => u.id)).size).toBe(UPGRADES.length);
  });

  it('помощники приносят доход за прошедшее время', () => {
    const s = { ...newGame(0), levels: { cashier: 3 } };
    expect(tick(s, 10_000).money).toBeCloseTo(30);
  });

  it('буст удваивает доход и копится не больше часа', () => {
    let s: GameState = { ...newGame(0), levels: { cashier: 1 } };
    s = addBoost(s, 0);
    expect(incomePerSecond(s, 1000)).toBe(2);
    for (let i = 0; i < 10; i++) s = addBoost(s, 0);
    expect(s.boostUntil).toBe(60 * 60 * 1000);
  });

  it('офлайн-доход ограничен четырьмя часами и не учитывает буст', () => {
    const s = addBoost({ ...newGame(0), levels: { cashier: 1 } }, 0);
    expect(offlineEarnings(s, 24 * 3600 * 1000)).toBe(OFFLINE_CAP_SECONDS);
    expect(collectOffline(s, 24 * 3600 * 1000, 2).money).toBe(OFFLINE_CAP_SECONDS * 2);
  });

  it('переезд сбрасывает улучшения и даёт множитель', () => {
    const s = { ...newGame(0), money: 5, runEarned: LOCATIONS[1].threshold, levels: { cashier: 1 } };
    expect(canRelocate(s)).toBe(true);
    const r = relocate(s, 0);
    expect(r.location).toBe(1);
    expect(r.money).toBe(0);
    expect(r.levels).toEqual({});
    expect(tapValue(r, 0)).toBe(LOCATIONS[1].mult);
  });

  it('после дворца можно расширять дворец звёздами без конца', () => {
    const last = LOCATIONS.length - 1;
    const s = { ...newGame(0), location: last, runEarned: LOCATIONS[last].threshold * 3 };
    expect(canRelocate(s)).toBe(false); // первая звезда — в 4 раза дороже входа во дворец
    const m1 = nextMove(s);
    expect(m1.star).toBe(1);
    expect(m1.mult).toBe(LOCATIONS[last].mult * 3);
    const r = relocate({ ...s, runEarned: m1.threshold }, 0);
    expect(r.location).toBe(last);
    expect(r.stars).toBe(1);
    expect(r.levels).toEqual({});
    expect(tapValue(r, 0)).toBe(LOCATIONS[last].mult * 3);
    expect(nextMove(r).threshold).toBe(m1.threshold * 4);
    expect(normalize({ version: 7, location: last, stars: 2 }, 0).stars).toBe(2);
    expect(normalize({ version: 7 }, 0).stars).toBe(0);
  });
});

describe('сохранения', () => {
  it('битое сохранение превращается в новую игру', () => {
    expect(normalize('мусор', 5).money).toBe(0);
    expect(normalize({ money: -3, levels: { nope: 4 } }, 5)).toMatchObject({ money: 0, levels: {} });
  });

  it('сохранение первой версии переносится', () => {
    const s = normalize({ version: 7, money: 50, levels: { recipe: 2, helper: 1 }, lastSeen: 7 }, 9);
    expect(s.levels).toEqual({ knife: 2, grill_helper: 1 });
    expect(s.money).toBe(50);
    expect(s.lastSeen).toBe(7);
  });

  it('старые сохранения начинают сюжет с коробки у помойки, питомцы и покупки остаются', () => {
    const s = normalize({ version: 6, location: 3, money: 5e9, runEarned: 6e9, levels: { knife: 40 }, pets: { gusini: { count: 2, mut: 0 } }, owned: { noAds: true } }, 0);
    expect(s).toMatchObject({ location: 0, money: 0, runEarned: 0, levels: {} });
    expect(s.pets.gusini.count).toBe(2);
    expect(s.owned.noAds).toBe(true);
    // версия 7 жила на семи точках: пляж → метро, джунгли → пустыня, площадь и дворец сдвигаются
    expect(normalize({ version: 7, location: 2, money: 5 }, 0)).toMatchObject({ location: 1, money: 5 });
    expect(normalize({ version: 7, location: 3, money: 5 }, 0)).toMatchObject({ location: 2 });
    expect(normalize({ version: 7, location: 6, stars: 2 }, 0)).toMatchObject({ location: 4, stars: 2 });
    expect(normalize({ version: 8, location: 3 }, 0)).toMatchObject({ location: 3 });
    expect(LOCATIONS.length).toBe(5);
    expect(LOCATIONS[0].id).toBe('dump');
    expect(LOCATIONS[LOCATIONS.length - 1].id).toBe('palace');
  });

  it('зазывала Тунг Тунг: три уровня по ×1,5 ко всему доходу, каждый заметно дороже', () => {
    const base = { ...newGame(0), levels: { grill_helper: 10, knife: 5 } };
    const def = UPGRADES.find((u) => u.id === 'barker')!;
    expect(upgradeCost(def, 1)).toBe(upgradeCost(def, 0) * 30);
    const one = { ...base, levels: { ...base.levels, barker: 1 } };
    const three = { ...base, levels: { ...base.levels, barker: 3 } };
    expect(incomePerSecond(one, 0) / incomePerSecond(base, 0)).toBeCloseTo(1.5);
    expect(tapValue(three, 0) / tapValue(base, 0)).toBeCloseTo(3.375);
    expect(isMaxed(three, def)).toBe(true);
  });
});

describe('числа', () => {
  it('сокращает большие числа', () => {
    expect(formatNumber(999, 'ru')).toBe('999');
    expect(formatNumber(0.2, 'ru')).toBe('0,2');
    expect(formatNumber(12.75, 'en')).toBe('12.7');
    expect(formatNumber(1234, 'ru')).toBe('1,23 тыс.');
    expect(formatNumber(2_500_000, 'en')).toBe('2.5M');
    expect(formatNumber(1e12, 'ru')).toBe('1 трлн');
    expect(formatNumber(100_000, 'en')).toBe('100K');
    expect(formatNumber(250_000_000, 'ru')).toBe('250 млн');
  });
});

describe('баланс', () => {
  it('первый переезд занимает 13–33 минуты активной игры', () => {
    const minutes = secondsToEarn(LOCATIONS[1].threshold, 3) / 60;
    expect(minutes).toBeGreaterThan(13);
    expect(minutes).toBeLessThan(33);
  });

  it('каждый следующий переезд занимает от 26 до 130 минут и дольше предыдущего', () => {
    let prev = 0;
    for (let loc = 1; loc < LOCATIONS.length - 1; loc++) {
      const minutes = secondsToEarn(LOCATIONS[loc + 1].threshold, 3, { ...newGame(0), location: loc }) / 60;
      expect(minutes).toBeGreaterThan(26);
      expect(minutes).toBeLessThan(130);
      expect(minutes).toBeGreaterThan(prev);
      prev = minutes;
    }
  });

  it('первые звёзды дворца тоже занимают от 5 минут до полутора часов', () => {
    for (let stars = 0; stars < 3; stars++) {
      const s = { ...newGame(0), location: LOCATIONS.length - 1, stars };
      const minutes = secondsToEarn(nextMove(s).threshold, 3, s) / 60;
      expect(minutes).toBeGreaterThan(5);
      expect(minutes).toBeLessThan(90);
    }
  });

  it('комбо даёт от ×1 до ×2 к тапу', () => {
    expect(comboMult(0)).toBe(1);
    expect(comboMult(25)).toBe(1.5);
    expect(comboMult(500)).toBe(2);
    expect(tap(newGame(0), 0, comboMult(50)).money).toBe(2);
  });

  it('лучшая серия запоминается', () => {
    const s = recordCombo(recordCombo(newGame(0), 30), 10);
    expect(s.bestCombo).toBe(30);
  });

  it('щедрый гость приносит деньги и считается', () => {
    const s = catchGolden(newGame(0), 0);
    expect(s.money).toBe(goldenReward(newGame(0), 0));
    expect(s.goldenCaught).toBe(1);
  });

  it('достижения выдаются один раз и увеличивают доход', () => {
    let s: GameState = { ...newGame(0), taps: 100, levels: { cashier: 1 } };
    const before = incomePerSecond(s, 0);
    const r = unlockAchievements(s);
    expect(r.unlocked).toEqual(['taps_100']);
    s = r.state;
    expect(unlockAchievements(s).unlocked).toEqual([]);
    expect(achievementMult(s)).toBeCloseTo(1.03);
    expect(incomePerSecond(s, 0)).toBeCloseTo(before * 1.03);
  });

  it('у всех достижений разные id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('старое сохранение получает пустые достижения', () => {
    const s = normalize({ version: 2, money: 5, achievements: ['taps_100', 7] }, 0);
    expect(s.achievements).toEqual(['taps_100']);
    expect(normalize({ money: 1 }, 0).achievements).toEqual([]);
  });

  it('пачка из 10 стоит как 10 покупок подряд', () => {
    const def = UPGRADE_BY_ID.knife;
    let one: GameState = { ...newGame(0), money: 1e6 };
    for (let i = 0; i < 10; i++) one = buy(one, 'knife');
    const ten = buyN({ ...newGame(0), money: 1e6 }, 'knife', 10);
    expect(ten.levels.knife).toBe(10);
    expect(ten.money).toBeCloseTo(one.money);
    expect(bulkCost(newGame(0), def, 1)).toBe(10);
  });

  it('пачку нельзя купить без денег, а максимум считает доступное', () => {
    const def = UPGRADE_BY_ID.knife;
    const s: GameState = { ...newGame(0), money: 25 };
    expect(canBuyN(s, 'knife', 10)).toBe(false);
    expect(maxAffordable(s, def)).toBe(2); // 10 + 12 = 22
    expect(bulkAmount(s, def, 'max')).toBe(2);
    expect(bulkAmount(newGame(0), def, 'max')).toBe(1);
  });

  it('множитель нельзя купить пачкой дважды', () => {
    const def = UPGRADE_BY_ID.sign;
    expect(bulkAmount({ ...newGame(0), money: 1e9 }, def, 'x10')).toBe(1);
    expect(maxAffordable({ ...newGame(0), money: 1e9 }, def)).toBe(1);
  });

  it('на каждой из пяти точек по семь своих брейнротов, гости с прошлой точки заходят редко', () => {
    const ids = (l: number) => customerPool(l).map((p) => p.id);
    expect(ids(0)).toContain('chimpanzini');
    expect(ids(0)).not.toContain('vaca');
    expect(ids(3)).toContain('vaca');
    expect(ids(4)).toContain('strawberry');
    expect(ids(4)).not.toContain('chimpanzini'); // у каждой точки свои персонажи
    for (let l = 0; l < LOCATIONS.length; l++) expect(BRAINROTS.filter((b) => b.role === 'customer' && b.home === l).length).toBe(7);
    // местные приходят гораздо чаще гостей с прошлой точки
    const pool = customerPool(1);
    const local = pool.filter((p) => p.id === 'trictrac')[0].weight;
    const guest = pool.filter((p) => p.id === 'boneca')[0].weight;
    expect(local).toBeGreaterThan(guest * 4);
    // у каждого посетителя есть редкость питомца
    for (const b of BRAINROTS) expect(PET_RARITY[b.id]).toBeDefined();
    expect(ids(0)).toContain(pickCustomer(0, 0.999));
  });

  it('каждый гость платит свой чек: богатые больше, но приходят реже', () => {
    const s = { ...newGame(0), levels: { grill_helper: 10, knife: 5 } };
    const pays = BRAINROTS.filter((b) => b.role === 'customer').map((b) => payOf(b.id));
    expect(new Set(pays).size).toBeGreaterThan(8); // чеки действительно разные
    expect(customerCheck(s, 0, 'bobritto')).toBeGreaterThan(customerCheck(s, 0, 'boneca') * 2);
    expect(customerCheck(newGame(0), 0, 'timcheese')).toBeGreaterThanOrEqual(1);
    const before = s.money;
    expect(serveCustomer(s, 0, 'bobritto').money).toBe(before + customerCheck(s, 0, 'bobritto'));
    const pool = customerPool(0);
    expect(pool.find((p) => p.id === 'bobritto')!.weight).toBeLessThan(pool.find((p) => p.id === 'boneca')!.weight);
    for (let l = 0; l < LOCATIONS.length; l++) expect(averagePay(l)).toBeGreaterThan(0.7);
    // работники обслуживают гостя раз в 3–4,5 секунды
    expect(serveIntervalMs(newGame(0), 0)).toBe(4500);
    expect(serveIntervalMs({ ...newGame(0), levels: { food_truck: 100 } }, 0)).toBeGreaterThanOrEqual(3000);
  });

  it('шансы ящиков складываются в 100 %, редкие стали чуть чаще', () => {
    for (const kind of ['common', 'golden'] as const) {
      expect(Object.values(BOX_ODDS[kind]).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    }
    expect(BOX_ODDS.common.legendary).toBeGreaterThan(2.5);
    expect(BOX_ODDS.golden.legendary).toBeGreaterThan(14);
  });

  it('знакомство с брейнротом записывается один раз', () => {
    let s = meet(newGame(0), 'tralalero');
    s = meet(s, 'tralalero');
    s = meet(s, 'unknown');
    expect(s.met).toEqual(['tralalero']);
    expect(new Set(BRAINROTS.map((b) => b.id)).size).toBe(BRAINROTS.length);
    expect(normalize({ met: ['tralalero', 3] }, 0).met).toEqual(['tralalero']);
    expect(normalize({}, 0).musicOff).toBe(false);
    expect(normalize({ musicOff: true }, 0).musicOff).toBe(true);
  });
});

describe('внешний вид ларька', () => {
  it('первый уровень любого улучшения меняет ларёк', async () => {
    const { lookOf, lookKey } = await import('./look');
    const { UPGRADES } = await import('./upgrades');
    const base = lookKey(lookOf({}));
    for (const u of UPGRADES) expect(lookKey(lookOf({ [u.id]: 1 }))).not.toBe(base);
  });
  it('стадии и украшения растут по порогам', async () => {
    const { stage, tier } = await import('./look');
    expect([0, 1, 9, 10, 25, 50, 100, 400].map(stage)).toEqual([0, 1, 1, 2, 3, 4, 5, 5]);
    expect(tier({ knife: 9 })).toBe(0);
    expect(tier({ knife: 10 })).toBe(1);
    expect(tier({ knife: 150, grill_helper: 50 })).toBe(5);
  });
});

describe('версия 2.0', () => {
  it('критический тап: редкий и в 10 раз дороже', () => {
    expect(isCrit(0.01)).toBe(true);
    expect(isCrit(CRIT_CHANCE)).toBe(false);
    const s = newGame(0);
    expect(tap(s, 0, CRIT_MULT).money).toBe(tap(s, 0).money * 10);
  });

  const seq = (...xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };

  it('вехи удваивают отдачу на 10, 25, 50 уровне', async () => {
    const { milestoneMult, nextMilestone } = await import('./economy');
    expect([9, 10, 24, 25, 50, 100].map(milestoneMult)).toEqual([1, 2, 2, 4, 8, 16]);
    expect(nextMilestone(12)).toBe(25);
    const s9 = incomePerSecond({ ...newGame(0), levels: { cashier: 9 } }, 0);
    const s10 = incomePerSecond({ ...newGame(0), levels: { cashier: 10 } }, 0);
    expect(s10 / s9).toBeCloseTo((10 / 9) * 2);
  });

  it('ящик даёт питомца, повтор качает его, бонус растёт и переживает переезд', async () => {
    const { openBox, petMult, rollRarity } = await import('./pets');
    expect(rollRarity('common', 0)).toBe('common');
    expect(rollRarity('golden', 0)).toBe('rare');
    expect(rollRarity('common', 0.9999)).toBe('god');
    let s = newGame(0);
    const a = openBox(s, 'common', seq(0, 0, 0.5));
    expect(a.drop.isNew).toBe(true);
    expect(a.drop.rarity).toBe('common');
    s = a.state;
    expect(s.met).toContain(a.drop.id);
    const m1 = petMult(s);
    expect(m1).toBeCloseTo(1.03);
    const b = openBox(s, 'common', seq(0, 0, 0.5));
    expect(b.drop.isNew).toBe(false);
    expect(petMult(b.state)).toBeCloseTo(1.039);
    const moved = relocate({ ...b.state, runEarned: 1e20 }, 0);
    expect(moved.pets).toEqual(b.state.pets);
  });

  it('мутации: алмаз даёт ×5', async () => {
    const { openBox, petMult } = await import('./pets');
    const r = openBox(newGame(0), 'common', seq(0, 0, 0.001));
    expect(r.drop.mut).toBe(2);
    expect(petMult(r.state)).toBeCloseTo(1.15);
  });

  it('ящик за деньги списывает цену и дорожает', async () => {
    const { boxCost, buyBox } = await import('./economy');
    const s = { ...newGame(0), money: 1e6 };
    const c = boxCost(s, 0);
    const r = buyBox(s, 0, seq(0.1, 0.1, 0.9))!;
    expect(r.state.money).toBe(1e6 - c);
    expect(boxCost(r.state, 0)).toBeGreaterThan(c);
    expect(buyBox(newGame(0), 0, Math.random)).toBeNull();
  });

  it('Бомбардиро: лихорадка ×7 к доходу, бешеные тапы ×10', async () => {
    const { applyGolden } = await import('./economy');
    const s = { ...newGame(0), levels: { cashier: 1, knife: 1 } };
    const f = applyGolden(s, 0, 'frenzy');
    expect(incomePerSecond(f, 1000) / incomePerSecond(s, 1000)).toBeCloseTo(7);
    expect(incomePerSecond(f, 40_000)).toBeCloseTo(incomePerSecond(s, 40_000));
    const t2 = applyGolden(s, 0, 'taps');
    expect(tapValue(t2, 1000) / tapValue(s, 1000)).toBeCloseTo(10);
    expect(t2.goldenCaught).toBe(1);
  });

  it('ежедневная награда: серия растёт, пропуск сбрасывает, дважды в день нельзя', async () => {
    const { claimDaily } = await import('./daily');
    let s = newGame(0);
    const d1 = claimDaily(s, 0, '2026-10-17', '2026-10-16')!;
    expect(d1.state.daily).toEqual({ streak: 1, last: '2026-10-17' });
    expect(d1.money).toBeGreaterThan(0);
    expect(claimDaily(d1.state, 0, '2026-10-17', '2026-10-16')).toBeNull();
    const d2 = claimDaily(d1.state, 0, '2026-10-18', '2026-10-17')!;
    expect(d2.state.daily.streak).toBe(2);
    const d3 = claimDaily(d2.state, 0, '2026-10-19', '2026-10-18')!;
    expect(d3.boxes).toEqual(['common']);
    const late = claimDaily(d3.state, 0, '2026-10-25', '2026-10-24')!;
    expect(late.state.daily.streak).toBe(1);
  });

  it('задания: три штуки, выполненное меняется на новое и даёт награду', async () => {
    const { ensureQuests, claimQuest, questDone } = await import('./quests');
    let s = ensureQuests(newGame(0), 0, seq(0, 0.5, 0.2, 0.5, 0.4, 0.5));
    expect(s.quests).toHaveLength(3);
    expect(new Set(s.quests.map((q) => q.kind)).size).toBe(3);
    const i = s.quests.findIndex((q) => q.kind === 'taps');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(claimQuest(s, i, 0, Math.random)).toBeNull();
    s = { ...s, taps: s.taps + s.quests[i].target };
    expect(questDone(s, s.quests[i])).toBe(true);
    const r = claimQuest(s, i, 0, Math.random)!;
    expect(r.state.quests).toHaveLength(3);
    expect(r.state.questsDone).toBe(1);
  });

  it('старое сохранение получает пустых питомцев, календарь и задания', () => {
    const s = normalize({ money: 5, pets: { tralalero: { count: 2, mut: 9 }, bad: { count: 0 } } }, 0);
    expect(s.pets).toEqual({ tralalero: { count: 2, mut: 2, stars: 0 } });
    expect(s.daily).toEqual({ streak: 0, last: '' });
    expect(s.quests).toEqual([]);
    expect(s.bought).toBe(0);
  });
});

// ---------- версия 2.9: слияние брейнротов ----------
import { STAR_MULT, canMerge, mergePet, petBonus, anyMerge } from './pets';
import { decodeWeekly, sell, soldThisWeek, weekEndsAt, weekId, weeklyScore } from './economy';

describe('слияние брейнротов', () => {
  const withPet = (count: number, stars = 0, mut = 0): GameState => ({ ...newGame(0), pets: { gusini: { count, mut, stars } } });

  it('нужно три копии, звёзд не больше трёх', () => {
    expect(canMerge(withPet(2).pets.gusini)).toBe(false);
    expect(canMerge(withPet(3).pets.gusini)).toBe(true);
    expect(canMerge(withPet(5, 3).pets.gusini)).toBe(false);
    expect(anyMerge(withPet(3))).toBe(true);
    expect(anyMerge(withPet(2))).toBe(false);
  });

  it('три копии становятся одной со звездой, мутация остаётся', () => {
    const s = mergePet(withPet(4, 0, 2), 'gusini');
    expect(s.pets.gusini).toEqual({ count: 2, mut: 2, stars: 1 });
    expect(s.merges).toBe(1);
    expect(mergePet(withPet(2), 'gusini')).toEqual(withPet(2));
  });

  it('слияние всегда выгоднее, чем копить копии', () => {
    for (let stars = 0; stars < 3; stars++) {
      const before = petBonus('gusini', withPet(3, stars).pets.gusini);
      const after = petBonus('gusini', mergePet(withPet(3, stars), 'gusini').pets.gusini);
      expect(after).toBeGreaterThan(before * 1.3);
    }
    expect(STAR_MULT.length).toBe(4);
  });

  it('старые питомцы без звёзд получают 0 звёзд', () => {
    const s = normalize({ version: 8, pets: { gusini: { count: 3, mut: 1 } } }, 0);
    expect(s.pets.gusini.stars).toBe(0);
  });
});

describe('продажи для лидерборда', () => {
  const mon = Date.UTC(2026, 9, 18, 21); // понедельник 19 октября 2026, 00:00 МСК
  it('неделя меняется в понедельник в полночь по Москве', () => {
    expect(weekId(mon) - weekId(mon - 1)).toBe(1);
    expect(weekId(mon + 6.9 * 86_400_000)).toBe(weekId(mon));
    expect(weekEndsAt(mon)).toBe(mon + 7 * 86_400_000);
  });

  it('тап и гость считаются продажей, новая неделя с нуля', () => {
    let s = { ...newGame(mon), money: 0 };
    s = tap(s, mon);
    s = serveCustomer(s, mon + 1000, 'gusini');
    expect(s.sold).toBe(2);
    expect(soldThisWeek(s, mon + 1000)).toBe(2);
    const next = mon + 7 * 86_400_000 + 5;
    expect(soldThisWeek(s, next)).toBe(0);
    s = sell(s, next);
    expect(s.week.sold).toBe(1);
    expect(s.sold).toBe(3);
  });

  it('недельные очки: прошлые недели ниже, видна только текущая', () => {
    const s = sell(newGame(mon), mon, 1234);
    const score = weeklyScore(s, mon);
    expect(decodeWeekly(score, mon)).toBe(1234);
    expect(decodeWeekly(score, mon + 7 * 86_400_000)).toBeNull();
    expect(weeklyScore(newGame(mon), mon + 7 * 86_400_000)).toBeGreaterThan(score);
    expect(weeklyScore(sell(s, mon, 5_000_000), mon) % 1_000_000).toBe(999_999);
    expect(weeklyScore(s, mon)).toBeLessThan(2 ** 31);
  });

  it('старое сохранение: продажи начинаются с числа тапов', () => {
    const s = normalize({ version: 8, taps: 500 }, mon);
    expect(s.sold).toBe(500);
    expect(s.week).toEqual({ id: weekId(mon), sold: 0 });
  });
});
