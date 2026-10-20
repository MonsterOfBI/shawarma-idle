// Интерфейс поверх сцены: шапка с деньгами и бафами, боковые кнопки, пять вкладок
// (улучшения, брейнроты, задания, переезд, магазин), окна подарка, офлайн-дохода и открытия ящика.
// Обычный HTML и CSS: так проще делать прокрутку и раскладку под телефон и компьютер.

import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from './core/achievements';
import { DAILY, canClaimDaily, dayKey, nextDailyIndex } from './core/daily';
import {
  type BuyMode,
  type GameState,
  adBoxReady,
  adBoxDone,
  adBoxesLeft,
  AD_BOXES_PER_DAY,
  boostActive,
  boxCost,
  bulkAmount,
  bulkCost,
  canBuyBox,
  canBuyN,
  canRelocate,
  cashPackAmount,
  costOf,
  incomePerSecond,
  isMaxed,
  isVisible,
  level,
  milestonesReached,
  minutesOfIncome,
  nextMove,
  moveKey,
  runTime,
  locationMult,
  nextMilestone,
  MILESTONES,
  tapValue,
} from './core/economy';
import { formatDuration, formatNumber } from './core/format';
import { LOCATIONS } from './core/locations';
import { BRAINROTS, BRAINROT_BY_ID, payOf } from './core/brainrots';
import { BOX_ODDS, type BoxKind, type Drop, MAX_STARS, MERGE_COPIES, PET_RARITY, RARITIES, type Rarity, anyMerge, canMerge, petBonus, petMult, pityLeft } from './core/pets';
import { QUEST_SLOTS, questDone, questProgress, counter } from './core/quests';
import { UPGRADES } from './core/upgrades';
import { lang, t } from './i18n';
import { awardIcon, icon, ui } from './icons';
import type { Board, LbResult, Product, ProductId } from './platform/platform';

export interface UiActions {
  buy(id: string, n: number): void;
  toggleMusic(): void;
  toggleSound(): void;
  boost(): void;
  relocate(): void;
  purchase(id: ProductId): void;
  buyBox(): void;
  adBox(): void;
  claimDaily(): void;
  openDaily(): void;
  claimQuest(i: number): void;
  merge(id: string): void;
  openLeaderboard(): void;
}

// Что нужно окну рейтинга от игры.
export interface LeaderboardSource {
  available: boolean;
  authorized(): boolean;
  login(): Promise<boolean>;
  load(board: Board): Promise<LbResult | null>;
  mine(board: Board): number;
  decode(board: Board, score: number): number | null;
  resetIn(): number; // секунд до новой недели
}

const starText = (n: number) => '★'.repeat(n);

// Название точки; дворец со звёздами пишется как «Дворец шаурмы ★2».
function placeName(id: string, star: number): string {
  return star > 0 ? t('loc_star', star) : t(`loc_${id}`);
}

export type Tab = 'upgrades' | 'pets' | 'quests' | 'move' | 'shop';
const TABS: Tab[] = ['upgrades', 'pets', 'quests', 'move', 'shop'];
const TAB_ICON: Record<Tab, string> = { upgrades: 'up', pets: 'crate', quests: 'list', move: 'truck', shop: 'coin' };
const QUEST_ICON: Record<string, string> = { taps: 'finger', buy: 'up', golden: 'golden', box: 'crate', earn: 'coin', combo: 'combo' };
// питомцы в сетке по редкости: сначала обычные
const PET_IDS = Object.keys(PET_RARITY).sort((a, b) => RARITIES.indexOf(PET_RARITY[a]) - RARITIES.indexOf(PET_RARITY[b]));

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const fmt = (n: number) => formatNumber(n, lang());
const pct = (x: number) => (x * 100 >= 10 ? Math.round(x * 100) : Math.round(x * 1000) / 10).toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function el(tag: string, cls: string, text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function today(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dayKey(d);
}

interface Row {
  root: HTMLElement;
  icon: HTMLElement;
  lv: HTMLElement;
  name: HTMLElement;
  desc: HTMLElement;
  ms: HTMLElement;
  msBar: HTMLElement;
  msText: HTMLElement;
  btn: HTMLButtonElement;
  lastLevel: number;
  seen: boolean; // кнопку уже показывали (блик только при смене «нельзя» на «можно»)
}

interface PetCard {
  root: HTMLElement;
  img: HTMLImageElement;
  name: HTMLElement;
  bonus: HTMLElement;
  lv: HTMLElement;
  mut: HTMLElement;
  stars: HTMLElement;
  merge: HTMLElement;
  key: string;
}

export class Ui {
  private rows = new Map<string, Row>();
  private medals = new Map<string, HTMLElement>();
  private petCards = new Map<string, PetCard>();
  private portraits: Record<string, string> = {};
  private previews: Record<string, string> = {};
  private previewLoading = new Set<string>();
  private previewSource?: (index: number) => Promise<string>;
  private products: Product[] = [];
  private purchasesAvailable = false;
  private moveArmed = false;
  private tab: Tab = 'upgrades';
  private mode: BuyMode = 'x1';
  private shownMoney = -1;
  private soundIcon: boolean | null = null;
  private lastState?: GameState;
  private questKey = '';
  private buffKey = '';

  constructor(private actions: UiActions) {
    document.title = t('title');
    const tabLabel: Record<Tab, string> = { upgrades: t('tabUpgrades'), pets: t('tabPets'), quests: t('tabQuests'), move: t('tabMove'), shop: t('tabShop') };
    for (const id of TABS) {
      const b = $(`#tab-${id}`);
      b.querySelector('.ico')!.innerHTML = ui(TAB_ICON[id]);
      b.querySelector('span')!.textContent = tabLabel[id];
      b.addEventListener('click', () => this.showTab(id));
    }
    $('#money-coin').innerHTML = ui('coin');
    $('#ico-sec').innerHTML = ui('bolt');
    $('#ico-tap').innerHTML = ui('finger');
    $('#hint').textContent = t('tapHint');
    $('#rush-title').textContent = t('rushTitle');
    $('.loading span')?.replaceChildren(t('title'));
    $('#sound').setAttribute('aria-label', t('sound'));
    $('#music').setAttribute('aria-label', t('music'));
    $('#music').innerHTML = ui('music');
    $('#sound').addEventListener('click', () => actions.toggleSound());
    $('#music').addEventListener('click', () => actions.toggleMusic());
    $('#lb-btn').innerHTML = ui('trophy');
    $('#lb-btn').setAttribute('aria-label', t('lbBtn'));
    $('#lb-btn').addEventListener('click', () => actions.openLeaderboard());

    // боковые кнопки
    const side = (id: string, ico: string, label: string, fn: () => void) => {
      const b = $(id);
      b.querySelector('.ico')!.innerHTML = ui(ico);
      b.querySelector('span')!.textContent = label;
      b.addEventListener('click', fn);
    };
    side('#btn-daily', 'gift', t('sideDaily'), () => actions.openDaily());
    side('#btn-quests', 'list', t('sideQuests'), () => this.showTab('quests'));
    side('#boost', 'x2', t('sideBoost'), () => actions.boost());
    side('#btn-adbox', 'goldcrate', t('sideBox'), () => actions.adBox());
    side('#btn-move', 'truck', t('sideMove'), () => this.showTab('move'));

    // улучшения
    $('#h-upgrades').textContent = t('hUpgrades');
    for (const b of document.querySelectorAll<HTMLButtonElement>('#buy-mode button')) {
      const mode = b.dataset.mode as BuyMode;
      b.textContent = t(mode === 'x1' ? 'buyX1' : mode === 'x10' ? 'buyX10' : 'buyMax');
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        this.mode = mode;
        this.syncMode();
        if (this.lastState) this.renderUpgrades(this.lastState, Date.now());
      });
    }
    this.syncMode();
    const list = $('#upgrades');
    for (const u of UPGRADES) {
      const root = el('div', `card up kind-${u.kind}`);
      const ic = el('div', 'up-icon');
      const lv = el('span', 'up-lv');
      ic.append(lv);
      const info = el('div', 'up-info');
      const name = el('div', 'up-name');
      const desc = el('div', 'up-desc');
      const ms = el('div', 'up-ms');
      const bar = el('div', 'bar');
      const msBar = el('div', '');
      bar.append(msBar);
      const msText = el('span', '');
      ms.append(bar, msText);
      info.append(name, desc, ms);
      const btn = el('button', 'btn') as HTMLButtonElement;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (this.lastState) actions.buy(u.id, bulkAmount(this.lastState, u, this.mode));
      });
      root.append(ic, info, btn);
      list.append(root);
      this.rows.set(u.id, { root, icon: ic, lv, name, desc, ms, msBar, msText, btn, lastLevel: -1, seen: false });
    }

    // брейнроты
    $('#h-pets').textContent = t('hPets');
    $('#box-name').textContent = t('boxName');
    $('#gbox-name').textContent = t('gboxName');
    const sum = (k: BoxKind, from: Rarity) => RARITIES.slice(RARITIES.indexOf(from)).reduce((a, r) => a + BOX_ODDS[k][r], 0);
    $('#box-odds').textContent = t('boxOdds', Math.round(sum('common', 'epic')));
    $('#gbox-odds').textContent = t('gboxOdds', Math.round(sum('golden', 'mythic')));
    $('#box-buy').addEventListener('click', () => actions.buyBox());
    $('#gbox-buy').addEventListener('click', () => actions.adBox());
    $('#gbox-buy').classList.add('ad');
    const grid = $('#pets');
    for (const id of PET_IDS) {
      const root = el('button', `pet r-${PET_RARITY[id]} unknown`);
      (root as HTMLButtonElement).type = 'button';
      const img = document.createElement('img');
      img.alt = '';
      const name = el('b', '', '???');
      const rar = el('span', 'pet-rar', t(`rar_${PET_RARITY[id]}`));
      const bonus = el('span', 'pet-bonus');
      const lv = el('span', 'pet-lv');
      const mut = el('span', 'pet-mut');
      const stars = el('span', 'pet-stars');
      const merge = el('span', 'pet-merge', t('petMerge'));
      merge.setAttribute('role', 'button');
      merge.hidden = true;
      merge.addEventListener('click', (e) => {
        e.stopPropagation();
        actions.merge(id);
      });
      root.append(img, stars, name, rar, bonus, lv, mut, merge);
      root.addEventListener('click', () => {
        if (!this.lastState?.pets[id]) return;
        if (canMerge(this.lastState.pets[id])) return actions.merge(id);
        // у посетителей свой чек: показываем, во сколько раз он больше среднего
        const check = BRAINROT_BY_ID[id]?.role === 'customer' ? ` · ${t('checkMult', formatNumber(payOf(id), lang()))}` : '';
        this.toast(`${t(`br_${id}`)}: «${t(`brs_${id}`)}»${check}`);
      });
      grid.append(root);
      this.petCards.set(id, { root, img, name, bonus, lv, mut, stars, merge, key: '' });
    }

    // задания и подарки
    $('#h-daily').textContent = t('hDaily');
    $('#h-quests').textContent = t('hQuests');
    $('#daily-claim').addEventListener('click', () => actions.claimDaily());
    $('#ach-title').textContent = t('achTitle');
    const awards = $('#awards');
    for (const a of ACHIEVEMENTS) {
      const m = el('div', 'medal');
      const disc = el('div', 'medal-disc');
      disc.innerHTML = awardIcon(a.id);
      m.append(disc, el('div', 'medal-name', t(`ach_${a.id}`)), el('div', 'medal-desc', t(`achd_${a.id}`)));
      awards.append(m);
      this.medals.set(a.id, m);
    }

    // переезд
    $('#h-move').textContent = t('tabMove');
    $('#move-kicker').textContent = t('moveKicker');
    $('#move-btn').addEventListener('click', () => {
      if (!this.moveArmed) {
        this.moveArmed = true;
        $('#move-btn').textContent = t('moveConfirm');
        setTimeout(() => (this.moveArmed = false), 4000);
        return;
      }
      this.moveArmed = false;
      actions.relocate();
    });
    const route = $('#route');
    LOCATIONS.forEach((l, i) => {
      const stop = el('div', 'stop');
      stop.append(el('i', '', String(i + 1)), el('b', '', t(`loc_${l.id}`)), el('span', '', `×${l.mult}`));
      route.append(stop);
    });

    $('#h-shop').textContent = t('hShop');
    this.showTab('upgrades');
  }

  /** Переключить вкладку меню. Меню всегда на экране. */
  showTab(id: Tab) {
    this.tab = id;
    for (const x of TABS) {
      $(`#tab-${x}`).setAttribute('aria-selected', String(x === id));
      $(`#panel-${x}`).hidden = x !== id;
    }
    if (this.lastState) this.render(this.lastState, Date.now());
  }

  private syncMode() {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#buy-mode button')) b.setAttribute('aria-checked', String(b.dataset.mode === this.mode));
  }

  setPreviewSource(fn: (index: number) => Promise<string>) {
    this.previewSource = fn;
  }

  setPortraits(map: Record<string, string>) {
    this.portraits = map;
    for (const [id, src] of Object.entries(map)) {
      const c = this.petCards.get(id);
      if (c) c.img.src = src;
    }
  }

  // Большая карточка при переезде на новую точку.
  moveCard(locId: string, mult: number, star = 0) {
    $('#move-card-kicker').textContent = t('moveCard');
    $('#move-card-name').textContent = placeName(locId, star);
    $('#move-card-desc').textContent = star ? t('locd_star') : t(`locd_${locId}`);
    $('#move-card-mult').textContent = t('moveCardMult', fmt(mult));
    const card = $('#move-card');
    card.hidden = false;
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    clearTimeout((card as any)._t);
    (card as any)._t = setTimeout(() => (card.hidden = true), 2600);
  }

  setProducts(products: Product[], available: boolean) {
    this.products = products;
    this.purchasesAvailable = available;
  }

  setRush(secondsLeft: number) {
    $('#rush').hidden = secondsLeft <= 0;
    if (secondsLeft > 0) $('#rush-text').textContent = t('rushText', Math.ceil(secondsLeft));
  }

  // Монетка из сцены долетела до кошелька: счётчик денег коротко подпрыгивает (не чаще раза в 90 мс).
  private bumpAt = 0;
  bumpMoney() {
    const now = performance.now();
    if (now - this.bumpAt < 90) return;
    this.bumpAt = now;
    // Web Animations: только transform, без перерасчёта раскладки страницы
    $('#money-pill').animate([{ transform: 'scale(1.07)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2, 1.4, .4, 1)' });
    $('#money-coin').animate([{ transform: 'rotateY(0) scale(1.25)' }, { transform: 'rotateY(1turn) scale(1)' }], { duration: 380, easing: 'ease-out' });
  }

  // Мигнуть карточкой улучшения, когда пройдена веха.
  milestoneHit(id: string) {
    const row = this.rows.get(id);
    if (!row) return;
    row.root.classList.remove('ms-hit');
    void row.root.offsetWidth;
    row.root.classList.add('ms-hit');
  }

  render(s: GameState, now: number) {
    this.lastState = s;
    // деньги «добегают» до нового значения, а при трате сразу падают
    if (this.shownMoney < 0 || s.money < this.shownMoney) this.shownMoney = s.money;
    else this.shownMoney += (s.money - this.shownMoney) * 0.35 + 0.01;
    if (Math.abs(s.money - this.shownMoney) < 1) this.shownMoney = s.money;
    $('#money').textContent = `${fmt(Math.floor(this.shownMoney))} ₽`;
    $('#rate-sec').textContent = t('perSec', fmt(incomePerSecond(s, now)));
    $('#rate-tap').textContent = t('perTap', fmt(tapValue(s, now)));
    $('#place').textContent = placeName(LOCATIONS[s.location].id, s.stars);
    $('#hint').hidden = s.taps > 5;
    if (this.soundIcon !== s.muted) {
      this.soundIcon = s.muted;
      $('#sound').innerHTML = ui(s.muted ? 'mute' : 'sound');
    }
    $('#sound').classList.toggle('off', s.muted);
    $('#music').classList.toggle('off', s.musicOff || s.muted);
    // боковые кнопки держим под шапкой
    const hud = $('#hud');
    $('#stage').style.setProperty('--side-top', `${hud.offsetTop + hud.offsetHeight + 34}px`);

    this.renderBuffs(s, now);
    this.renderSide(s, now);
    this.renderBadges(s, now);

    if (this.tab === 'upgrades') this.renderUpgrades(s, now);
    if (this.tab === 'pets') this.renderPets(s, now);
    if (this.tab === 'quests') this.renderQuests(s, now);
    if (this.tab === 'move') this.renderMove(s, now);
    if (this.tab === 'shop') this.renderShop(s, now);
  }

  private renderBuffs(s: GameState, now: number) {
    const left = (until: number) => formatDuration(Math.max(0, (until - now) / 1000), lang());
    const items: [string, string, string][] = [];
    if (boostActive(s, now)) items.push(['boost', 'x2', t('buffBoost', left(s.boostUntil))]);
    if (now < s.frenzyUntil) items.push(['frenzy', 'frenzy', t('buffFrenzy', left(s.frenzyUntil))]);
    if (now < s.tapFrenzyUntil) items.push(['taps', 'finger', t('buffTaps', left(s.tapFrenzyUntil))]);
    const stage = $('#stage');
    stage.classList.toggle('frenzy', now < s.frenzyUntil);
    stage.classList.toggle('tapfrenzy', now < s.tapFrenzyUntil);
    const box = $('#buffs');
    const key = items.map((i) => i[0]).join();
    if (key !== this.buffKey) {
      this.buffKey = key;
      box.replaceChildren(
        ...items.map(([cls, ico]) => {
          const b = el('span', `buff ${cls}`);
          const i = el('i', 'ico');
          i.innerHTML = ui(ico);
          b.append(i, el('span', ''));
          return b;
        }),
      );
    }
    items.forEach((it, k) => ((box.children[k] as HTMLElement).lastElementChild!.textContent = it[2]));
  }

  private renderSide(s: GameState, now: number) {
    const daily = canClaimDaily(s, today());
    const dailyBtn = $('#btn-daily');
    dailyBtn.classList.toggle('ready', daily);
    (dailyBtn.querySelector('.badge') as HTMLElement).hidden = !daily;

    const ready = s.quests.filter((q) => questDone(s, q)).length;
    const qb = $('#btn-quests').querySelector('.badge') as HTMLElement;
    qb.hidden = ready === 0;
    qb.textContent = String(ready);
    $('#btn-quests').classList.toggle('ready', ready > 0);

    const boosting = boostActive(s, now);
    $('#boost').classList.toggle('active', boosting);
    $('#boost-label').textContent = boosting ? formatDuration((s.boostUntil - now) / 1000, lang()) : t('sideBoost');

    const adReady = adBoxReady(s, now);
    const ab = $('#btn-adbox');
    ab.classList.toggle('ready', adReady);
    ab.classList.toggle('wait', !adReady);
    (ab.querySelector('.badge') as HTMLElement).hidden = !adReady;
    $('#adbox-label').textContent = adReady ? t('sideBox') : adBoxDone(s, now) ? t('boxTomorrow') : formatDuration((s.adBoxAt - now) / 1000, lang());

    // переезд готов: на улице появляется кнопка с грузовиком, вкладка «Переезд» качается
    const move = canRelocate(s);
    $('#btn-move').hidden = !move;
    $('#tab-move').classList.toggle('call', move && this.tab !== 'move');
  }

  private renderBadges(s: GameState, now: number) {
    const set = (tab: Tab, text: string) => {
      const b = $(`#tab-${tab}`).querySelector('.badge') as HTMLElement;
      b.hidden = !text || this.tab === tab;
      b.textContent = text;
    };
    const canUp = UPGRADES.some((u) => isVisible(s, u) && !isMaxed(s, u) && canBuyN(s, u.id, 1));
    set('upgrades', canUp ? '!' : '');
    set('pets', canBuyBox(s, now) || adBoxReady(s, now) || anyMerge(s) ? '!' : '');
    const n = s.quests.filter((q) => questDone(s, q)).length + (canClaimDaily(s, today()) ? 1 : 0);
    set('quests', n ? String(n) : '');
    set('move', canRelocate(s) ? '!' : '');
    set('shop', '');
  }

  private renderUpgrades(s: GameState, now: number) {
    let shownLocked = false;
    // подсказка новичку: пульсирует первое улучшение, которое уже по карману
    const fresh = Object.values(s.levels).every((v) => !v);
    let pulsed = false;
    for (const u of UPGRADES) {
      const row = this.rows.get(u.id)!;
      const visible = isVisible(s, u);
      // одно следующее закрытое улучшение показываем как «???», чтобы было куда стремиться
      row.root.hidden = !visible && shownLocked;
      if (!visible) {
        shownLocked = true;
        if (!row.root.classList.contains('locked')) {
          row.root.classList.add('locked');
          row.icon.innerHTML = icon('lock');
          row.icon.append(row.lv);
          row.lastLevel = -1;
        }
        row.lv.hidden = true;
        row.ms.hidden = true;
        row.name.textContent = '???';
        row.desc.textContent = t('locked');
        row.btn.textContent = `${fmt(u.baseCost)} ₽`;
        row.btn.disabled = true;
        row.btn.classList.remove('done', 'pulse');
        continue;
      }
      const lv = level(s, u.id);
      if (row.root.classList.contains('locked') || row.lastLevel === -1) {
        row.root.classList.remove('locked');
        row.icon.innerHTML = icon(u.id);
        row.icon.append(row.lv);
      }
      if (row.lastLevel >= 0 && lv > row.lastLevel) {
        row.root.classList.remove('flash');
        row.lv.classList.remove('pop');
        void row.root.offsetWidth;
        row.root.classList.add('flash');
        row.lv.classList.add('pop');
      }
      row.lastLevel = lv;
      row.lv.hidden = lv === 0 || (u.kind === 'mult' && (u.maxLevel ?? 1) === 1);
      row.lv.textContent = String(lv);
      row.name.textContent = t(`up_${u.id}`);
      if (u.kind === 'tap') {
        const after = tapValue({ ...s, levels: { ...s.levels, [u.id]: lv + 1 } }, now);
        row.desc.textContent = t('tapPlus', fmt(after - tapValue(s, now)));
      } else if (u.kind === 'helper') {
        const after = incomePerSecond({ ...s, levels: { ...s.levels, [u.id]: lv + 1 } }, now);
        row.desc.textContent = t('secPlus', fmt(after - incomePerSecond(s, now)));
      } else {
        if ((u.maxLevel ?? 1) > 1) row.desc.textContent = t('barkerNext', Math.min(lv + 1, u.maxLevel ?? 1));
        else row.desc.textContent = t(u.target === 'tap' ? 'multTap' : 'multAll', u.amount);
      }
      // вехи: полоска до следующего удвоения
      const next = u.kind === 'mult' ? undefined : nextMilestone(lv);
      row.ms.hidden = u.kind === 'mult' || lv === 0 || isMaxed(s, u);
      if (!row.ms.hidden) {
        const prev = MILESTONES[milestonesReached(lv) - 1] ?? 0;
        row.msBar.style.width = next ? `${((lv - prev) / (next - prev)) * 100}%` : '100%';
        row.msText.textContent = next ? t('milestone', next) : t('milestoneAll');
      }
      const maxed = isMaxed(s, u);
      const n = bulkAmount(s, u, this.mode);
      row.btn.classList.toggle('done', maxed);
      if (maxed) row.btn.textContent = t('bought');
      else if (n === 1 && this.mode === 'x1') row.btn.textContent = `${fmt(costOf(s, u))} ₽`;
      else row.btn.innerHTML = `<small>×${n}</small>${fmt(bulkCost(s, u, n))} ₽`;
      const off = maxed || !canBuyN(s, u.id, n);
      // цена только что стала по карману — по кнопке пробегает блик
      if (row.btn.disabled && !off && row.seen) {
        row.btn.classList.remove('shine');
        void row.btn.offsetWidth;
        row.btn.classList.add('shine');
        window.setTimeout(() => row.btn.classList.remove('shine'), 900);
      }
      row.seen = true;
      row.btn.disabled = off;
      const pulse = fresh && !pulsed && !row.btn.disabled;
      if (pulse) pulsed = true;
      row.btn.classList.toggle('pulse', pulse);
    }
  }

  private renderPets(s: GameState, now: number) {
    const owned = Object.keys(s.pets).filter((id) => PET_RARITY[id]).length;
    $('#pets-count').textContent = t('petsCount', owned).replace('{n}', String(Object.keys(PET_RARITY).length));
    const buy = $<HTMLButtonElement>('#box-buy');
    buy.textContent = `${fmt(boxCost(s, now))} ₽`;
    buy.disabled = !canBuyBox(s, now);
    const g = $<HTMLButtonElement>('#gbox-buy');
    const ready = adBoxReady(s, now);
    g.disabled = !ready;
    const left = adBoxesLeft(s, now);
    g.textContent = ready ? t('boxFree') : left === 0 ? t('boxTomorrow') : t('boxWait', formatDuration((s.adBoxAt - now) / 1000, lang()));
    $('#gbox-left').textContent = t('gboxLeft', left).replace('{max}', String(AD_BOXES_PER_DAY));
    const pl = pityLeft(s);
    $('#pity-note').innerHTML = t('pityNote', `<b>${pl.mythic}</b>`).replace('{l}', `<b>${pl.legend}</b>`);
    const banner = $('#pet-bonus');
    if (!owned) banner.textContent = t('petsHint');
    else banner.innerHTML = `${t('petBonusLabel')} <b>+${pct(petMult(s) - 1)} %</b>`;
    $('#merge-note').textContent = owned ? t('mergeNote') : '';
    for (const id of PET_IDS) {
      const c = this.petCards.get(id)!;
      const p = s.pets[id];
      const key = p ? `${p.count}:${p.mut}:${p.stars}` : '';
      if (key === c.key) continue;
      const wasUnknown = !c.key;
      c.key = key;
      c.root.classList.toggle('unknown', !p);
      c.root.classList.remove('m-1', 'm-2', 'st-1', 'st-2', 'st-3', 'can-merge');
      c.name.textContent = p ? t(`br_${id}`) : '???';
      c.bonus.hidden = c.lv.hidden = !p;
      c.mut.hidden = !p || !p.mut;
      if (!p) continue;
      if (p.mut) {
        c.root.classList.add(`m-${p.mut}`);
        c.mut.textContent = t(`mutShort_${p.mut}`);
        c.mut.classList.toggle('diamond', p.mut === 2);
      }
      c.bonus.textContent = `+${pct(petBonus(id, p))} %`;
      // пока можно копить звёзды — показываем копии «2/3», после трёх звёзд — просто уровень
      c.lv.textContent = p.stars < MAX_STARS ? `${Math.min(p.count, 99)}/${MERGE_COPIES}` : t('level', p.count);
      c.stars.textContent = starText(p.stars);
      if (p.stars) c.root.classList.add(`st-${p.stars}`);
      const ready = canMerge(p);
      c.root.classList.toggle('can-merge', ready);
      c.merge.hidden = !ready;
      if (wasUnknown) {
        c.root.classList.remove('fresh');
        void c.root.offsetWidth;
        c.root.classList.add('fresh');
      }
    }
  }

  // Полоска из 7 дней. Используется и во вкладке, и в окне подарка.
  private fillDaily(box: HTMLElement, s: GameState, now: number) {
    const can = canClaimDaily(s, today());
    const next = can ? nextDailyIndex(s, today()) : -1;
    const done = can ? next : s.daily.streak;
    box.replaceChildren(
      ...DAILY.map((d, i) => {
        const tile = el('div', `day${i === 6 ? ' day7' : ''}${i < done ? ' done' : ''}${i === next ? ' today' : ''}`);
        const ico = el('i', 'ico');
        ico.innerHTML = ui(d.box === 'golden' ? 'goldcrate' : d.box ? 'crate' : 'coin');
        const label = d.minutes ? fmt(minutesOfIncome(s, now, d.minutes)) : d.box === 'golden' ? t('dailyGold') : (d.boxes ?? 1) > 1 ? t('dailyBoxes', d.boxes!) : t('dailyBox');
        tile.append(el('span', '', t('dailyDay', i + 1)), ico, el('small', '', label));
        return tile;
      }),
    );
    return can;
  }

  private renderQuests(s: GameState, now: number) {
    const can = this.fillDaily($('#daily-strip'), s, now);
    $('#daily-streak').textContent = t('dailyStreak', can ? nextDailyIndex(s, today()) : s.daily.streak);
    const claim = $<HTMLButtonElement>('#daily-claim');
    claim.disabled = !can;
    claim.textContent = can ? t('dailyClaim') : t('dailyTaken');

    const box = $('#quests');
    const waits = [...(s.questWait ?? [])].sort((a, b) => a - b).slice(0, Math.max(0, QUEST_SLOTS - s.quests.length));
    const key = s.quests.map((q) => `${q.kind}${q.target}${q.start}`).join() + `|${waits.length}`;
    if (key !== this.questKey) {
      this.questKey = key;
      box.replaceChildren(
        ...s.quests.map((q, i) => {
          const card = el('div', 'card quest');
          const ic = el('div', 'quest-ico');
          ic.innerHTML = icon(QUEST_ICON[q.kind]);
          const info = el('div', '');
          const name = el('div', 'quest-name', t(`q_${q.kind}`, q.kind === 'earn' ? fmt(q.target) : q.target));
          const prog = el('div', 'quest-prog');
          const bar = el('div', 'bar');
          bar.append(el('div', ''));
          prog.append(bar, el('span', ''));
          info.append(name, prog);
          const btn = el('button', 'btn btn-green') as HTMLButtonElement;
          btn.type = 'button';
          btn.addEventListener('click', () => this.actions.claimQuest(i));
          card.append(ic, info, btn);
          return card;
        }),
        // места выполненных заданий: новое задание придёт по таймеру
        ...waits.map(() => {
          const card = el('div', 'card quest wait');
          const ic = el('div', 'quest-ico');
          ic.innerHTML = icon('list');
          const info = el('div', '');
          info.append(el('div', 'quest-name', t('questWaitTitle')), el('div', 'quest-wait-text', ''));
          card.append(ic, info, el('div', 'quest-timer', ''));
          return card;
        }),
      );
    }
    waits.forEach((at, k) => {
      const card = box.children[s.quests.length + k] as HTMLElement | undefined;
      if (!card) return;
      const left = Math.max(0, Math.ceil((at - now) / 1000));
      (card.querySelector('.quest-timer') as HTMLElement).textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      (card.querySelector('.quest-wait-text') as HTMLElement).textContent = t('questWaitText');
    });
    s.quests.forEach((q, i) => {
      const card = box.children[i] as HTMLElement;
      const p = questProgress(s, q);
      const done = questDone(s, q);
      card.classList.toggle('ready', done);
      (card.querySelector('.bar > div') as HTMLElement).style.width = `${p * 100}%`;
      const have = q.kind === 'combo' ? Math.min(counter(s, 'combo'), q.target) : Math.min(q.target, counter(s, q.kind) - q.start);
      (card.querySelector('.quest-prog span') as HTMLElement).textContent = q.kind === 'earn' ? `${Math.round(p * 100)} %` : `${have}/${q.target}`;
      const btn = card.querySelector('button') as HTMLButtonElement;
      btn.disabled = !done;
      const reward = q.reward.box
        ? `<span class="row"><i class="ico">${ui(q.reward.box === 'golden' ? 'goldcrate' : 'crate')}</i>${t(q.reward.box === 'golden' ? 'dailyGold' : 'dailyBox')}</span>`
        : `+${fmt(minutesOfIncome(s, now, q.reward.minutes ?? 0))} ₽`;
      if (btn.dataset.r !== reward) {
        btn.dataset.r = reward;
        btn.innerHTML = reward;
      }
    });

    const got = new Set(s.achievements);
    $('#ach-count').textContent = t('achCount', got.size);
    $('#awards-note').textContent = t('achBonus', Math.round(got.size * ACHIEVEMENT_BONUS * 100));
    for (const a of ACHIEVEMENTS) {
      const m = this.medals.get(a.id)!;
      const has = got.has(a.id);
      m.classList.toggle('got', has);
      (m.firstElementChild as HTMLElement).style.setProperty('--p', String(has ? 1 : a.progress(s)));
    }
  }

  private renderMove(s: GameState, now: number) {
    const cur = LOCATIONS[s.location];
    const next = nextMove(s);
    $('#move-now').textContent = t('moveNow', placeName(cur.id, s.stars));
    $('#move-mult').textContent = t('moveMult', fmt(locationMult(s)));
    [...$('#route').children].forEach((stop, i) => {
      stop.classList.toggle('passed', i < s.location);
      stop.classList.toggle('here', i === s.location);
    });
    $('#move-next').hidden = false;
    $('#move-done').hidden = true;
    $('#move-next-name').textContent = placeName(next.id, next.star);
    $('#move-next-desc').textContent = next.star ? t('locd_star') : t(`locd_${next.id}`);
    // превью новой точки: открытка с фоном и ларьком, новые брейнроты силуэтами
    const nextIndex = LOCATIONS.findIndex((l) => l.id === next.id);
    const img = $<HTMLImageElement>('#move-preview');
    const pic = this.previews[next.id];
    if (pic) {
      if (img.getAttribute('src') !== pic) img.src = pic;
      img.hidden = false;
    } else {
      img.hidden = true;
      if (this.previewSource && !this.previewLoading.has(next.id)) {
        this.previewLoading.add(next.id);
        void this.previewSource(nextIndex).then((src) => {
          this.previews[next.id] = src;
          if (this.lastState) this.renderMove(this.lastState, Date.now());
        });
      }
    }
    const crew = $('#move-crew');
    const ids = next.star ? [] : BRAINROTS.filter((b) => b.home === nextIndex).map((b) => b.id);
    const crewKey = ids.map((id) => id + (s.met.includes(id) ? '1' : '0')).join(',') + Object.keys(this.portraits).length;
    if (crew.dataset.k !== crewKey) {
      crew.dataset.k = crewKey;
      crew.replaceChildren(
        ...ids.map((id) => {
          const known = s.met.includes(id);
          const sp = el('span', known ? '' : 'unknown');
          sp.title = known ? t(`br_${id}`) : '???';
          const im = document.createElement('img');
          im.alt = '';
          im.src = this.portraits[id] ?? '';
          sp.append(im);
          return sp;
        }),
      );
    }
    $('#move-gifts').innerHTML = `<span><i class="ico">${ui('goldcrate')}</i>${t('moveGiftLegend')}</span>`;
    const best = s.moveBest[moveKey(s)];
    const run = formatDuration(runTime(s, now) / 1000, lang());
    $('#move-speed').innerHTML =
      best === undefined
        ? t('moveSpeedFirst', `<b>${run}</b>`)
        : t('moveSpeedBest', `<b>${run}</b> / ${formatDuration(best / 1000, lang())}`);
    const p = Math.min(1, s.runEarned / next.threshold);
    $('#move-bar').style.width = `${(p * 100).toFixed(1)}%`;
    $('#move-progress').textContent = t('moveProgress', `${fmt(s.runEarned)} / ${fmt(next.threshold)} ₽`);
    $('#move-warn').textContent = t('moveWarn', Math.round(next.mult / locationMult(s)));
    const btn = $<HTMLButtonElement>('#move-btn');
    btn.disabled = !canRelocate(s);
    btn.classList.toggle('pulse', canRelocate(s));
    if (!this.moveArmed) btn.textContent = t('moveBtn');
  }

  private renderShop(s: GameState, now: number) {
    const box = $('#shop');
    const items: { id: ProductId; ico: string; name: string; text: string; owned: boolean; hot?: boolean }[] = [
      { id: 'x2_forever', ico: 'x2', name: t('shopX2'), text: t('shopX2Text'), owned: s.owned.x2Forever, hot: true },
      { id: 'no_ads', ico: 'play', name: t('shopNoAds'), text: t('shopNoAdsText'), owned: s.owned.noAds },
      { id: 'cash_pack', ico: 'bag', name: t('shopCash'), text: t('shopCashText', fmt(cashPackAmount(s, now))), owned: false },
      { id: 'god_pet', ico: 'goldcrate', name: t('shopGod'), text: t('shopGodText'), owned: false },
    ];
    if (box.childElementCount !== items.length + 1) {
      box.replaceChildren();
      box.append(el('p', 'shop-note'));
      for (const it of items) {
        const card = el('div', `card shop-item${it.hot ? ' hot' : ''}`);
        card.dataset.id = it.id;
        const ic = el('i', 'ico');
        ic.innerHTML = ui(it.ico);
        const info = el('div', '');
        info.append(el('div', 'shop-name'), el('div', 'shop-desc'));
        const btn = el('button', 'btn btn-amber') as HTMLButtonElement;
        btn.type = 'button';
        btn.addEventListener('click', () => this.actions.purchase(it.id));
        card.append(ic, info, btn);
        box.append(card);
      }
    }
    const note = box.querySelector('.shop-note') as HTMLElement;
    note.hidden = this.purchasesAvailable;
    note.textContent = t('shopUnavailable');
    for (const it of items) {
      const card = box.querySelector(`[data-id="${it.id}"]`) as HTMLElement;
      (card.querySelector('.shop-name') as HTMLElement).textContent = it.name;
      (card.querySelector('.shop-desc') as HTMLElement).textContent = it.text;
      const btn = card.querySelector('button') as HTMLButtonElement;
      const price = this.products.find((p) => p.id === it.id)?.price;
      btn.textContent = it.owned ? t('shopOwned') : price ?? t('shopBuy');
      btn.classList.toggle('done', it.owned);
      btn.disabled = it.owned || !this.purchasesAvailable || !price;
    }
  }

  toast(text: string, kind: 'plain' | 'medal' | 'money' = 'plain') {
    const box = $('#toast');
    box.textContent = text;
    box.classList.toggle('medal-toast', kind === 'medal');
    box.classList.toggle('money-toast', kind === 'money');
    box.hidden = false;
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout((box as any)._t);
    (box as any)._t = setTimeout(() => (box.hidden = true), kind === 'medal' ? 3200 : 2600);
  }

  // Открыто ли окно офлайн-дохода (страховка от зависшего флага в контроллере).
  anyModalOpen(): boolean {
    return !$('#offline').hidden;
  }

  // Окно «Пока вас не было» в виде чека. Возвращает выбор игрока.
  offline(amount: number, seconds: number, perSecond: number): Promise<'take' | 'double'> {
    $('#offline-title').textContent = t('offlineTitle');
    $('#offline-time-label').textContent = t('offlineTime');
    $('#offline-time').textContent = formatDuration(seconds, lang());
    $('#offline-rate-label').textContent = t('offlineRate');
    $('#offline-rate').textContent = t('perSec', fmt(perSecond));
    $('#offline-total-label').textContent = t('offlineTotal');
    $('#offline-text').textContent = `${fmt(amount)} ₽`;
    $('#offline-take').textContent = t('offlineTake');
    $('#offline-double').textContent = t('offlineDouble');
    $('#offline-double').classList.add('ad');
    const modal = $('#offline');
    modal.hidden = false;
    return new Promise((resolve) => {
      const done = (r: 'take' | 'double') => {
        modal.hidden = true;
        resolve(r);
      };
      $('#offline-take').onclick = () => done('take');
      $('#offline-double').onclick = () => done('double');
    });
  }

  // Окно «Подарок дня». Возвращает, забрал ли игрок подарок.
  daily(s: GameState, now: number): Promise<boolean> {
    const can = this.fillDaily($('#dm-strip'), s, now);
    $('#dm-kicker').textContent = t('dailyKicker');
    $('#dm-title').textContent = t('hDaily');
    const claim = $<HTMLButtonElement>('#dm-claim');
    claim.textContent = can ? t('dailyClaim') : t('dailyTaken');
    claim.disabled = !can;
    $('#dm-close').textContent = t('dailyClose');
    const modal = $('#daily-modal');
    modal.hidden = false;
    return new Promise((resolve) => {
      const done = (r: boolean) => {
        modal.hidden = true;
        resolve(r);
      };
      claim.onclick = () => done(true);
      $('#dm-close').onclick = () => done(false);
    });
  }

  // Открытие ящика: ящик трясётся, потом вылетает брейнрот в цвете редкости.
  // again — подпись кнопки «Ещё» (null, если повторить нельзя). Тап по тряске пропускает её.
  async reveal(drop: Drop, kind: BoxKind, again: string | null, onOpen: () => void, title = ''): Promise<'again' | 'ok'> {
    const box = $('#reveal');
    const crate = box.querySelector('.reveal-crate') as HTMLElement;
    crate.classList.toggle('gold', kind !== 'common');
    crate.classList.toggle('legend', kind === 'legend' || kind === 'god');
    const head = $('#rv-title');
    head.textContent = title;
    head.hidden = !title;
    box.className = 'reveal shake';
    box.hidden = false;
    let skip!: () => void;
    const skipped = new Promise<void>((r) => (skip = r));
    box.onclick = () => skip();
    await Promise.race([wait(1100), skipped]);
    box.onclick = null;
    box.className = `reveal open r-${drop.rarity}`;
    onOpen();
    $('#rv-rarity').textContent = t(`rar_${drop.rarity}`);
    ($('#rv-img') as HTMLImageElement).src = this.portraits[drop.id] ?? '';
    $('#rv-name').textContent = t(`br_${drop.id}`);
    const info = $('#rv-info');
    info.className = drop.isNew ? 'new' : drop.mut ? `mut-${drop.mut}` : '';
    const p = this.lastState?.pets[drop.id];
    info.textContent = [drop.pity ? t('pityHit') : '', drop.isNew ? t('petNew') : t('petUp', drop.level), drop.mut ? t(`mut_${drop.mut}`) : '', canMerge(p) ? t('mergeReady') : '']
      .filter(Boolean)
      .join(' · ');
    $('#rv-bonus').textContent = p ? t('petGives', pct(petBonus(drop.id, p))) : '';
    const againBtn = $<HTMLButtonElement>('#rv-again');
    againBtn.hidden = !again;
    againBtn.innerHTML = again ? `<small>${t('rvAgain')}</small>${again}` : '';
    $('#rv-ok').textContent = t('rvOk');
    return new Promise((resolve) => {
      const done = (r: 'again' | 'ok') => {
        box.hidden = true;
        resolve(r);
      };
      againBtn.onclick = () => done('again');
      $('#rv-ok').onclick = () => done('ok');
    });
  }

  // Слияние: три портрета слетаются в один, вспышка, звёзды выскакивают по одной.
  async mergeShow(id: string, stars: number, bonusPct: number, onOpen: () => void): Promise<void> {
    const box = $('#merge');
    const src = this.portraits[id] ?? '';
    box.querySelectorAll<HTMLImageElement>('.merge-trio img').forEach((img) => (img.src = src));
    box.className = 'reveal merge fuse';
    box.hidden = false;
    let skip!: () => void;
    const skipped = new Promise<void>((r) => (skip = r));
    box.onclick = () => skip();
    await Promise.race([wait(1000), skipped]);
    box.onclick = null;
    box.className = 'reveal merge open';
    onOpen();
    $('#mg-kicker').textContent = t('mergeKicker');
    ($('#mg-img') as HTMLImageElement).src = src;
    $('#mg-name').textContent = t(`br_${id}`);
    const st = $('#mg-stars');
    st.innerHTML = '';
    for (let i = 0; i < MAX_STARS; i++) {
      const star = el('i', i < stars ? '' : 'dim', '★');
      star.style.animationDelay = `${0.25 + i * 0.18}s`;
      st.append(star);
    }
    $('#mg-bonus').textContent = t('petGives', pct(bonusPct));
    $('#mg-ok').textContent = t('mergeOk');
    return new Promise((resolve) => {
      $('#mg-ok').onclick = () => {
        box.hidden = true;
        resolve();
      };
    });
  }

  // Окно рейтинга: неделя и всё время. Без Яндекса показывает только свои продажи.
  async leaderboard(src: LeaderboardSource) {
    const modal = $('#lb-modal');
    $('#lb-title').textContent = t('lbTitle');
    $('.lb-cup').innerHTML = ui('trophy');
    $('#lb-close').textContent = t('lbClose');
    const seg = $('#lb-seg');
    const [bw, bt] = Array.from(seg.querySelectorAll<HTMLButtonElement>('button'));
    bw.textContent = t('lbWeek');
    bt.textContent = t('lbAll');
    const login = $<HTMLButtonElement>('#lb-login');
    login.textContent = t('lbLogin');
    let board: Board = 'week';
    let token = 0;
    const show = async () => {
      const my = ++token;
      bw.setAttribute('aria-checked', String(board === 'week'));
      bt.setAttribute('aria-checked', String(board === 'total'));
      $('#lb-mine').innerHTML = t(board === 'week' ? 'lbMineWeek' : 'lbMineAll', `<b>${fmt(src.mine(board))}</b>`);
      const left = src.resetIn();
      const leftText = left >= 86_400 ? t('durDH').replace('{d}', String(Math.floor(left / 86_400))).replace('{h}', String(Math.floor((left % 86_400) / 3600))) : formatDuration(left, lang());
      $('#lb-reset').textContent = board === 'week' ? t('lbReset', leftText) : '';
      login.hidden = !src.available || src.authorized();
      const list = $('#lb-list');
      const note = $('#lb-note');
      list.innerHTML = '';
      if (!src.available) {
        note.textContent = `${t('lbLocal')} ${t('lbHow')}`;
        return;
      }
      note.textContent = t('lbLoading');
      const res = await src.load(board);
      if (my !== token) return;
      if (!res) {
        note.textContent = t('lbError');
        return;
      }
      const rows = res.entries
        .map((e) => ({ ...e, score: src.decode(board, e.score) }))
        .filter((e): e is typeof e & { score: number } => e.score !== null && e.score > 0);
      const seen = new Set<number>();
      let last = 0;
      for (const e of rows.sort((a, b) => a.rank - b.rank)) {
        if (seen.has(e.rank)) continue;
        seen.add(e.rank);
        if (last && e.rank > last + 1) list.append(el('li', 'gap', '⋯'));
        last = e.rank;
        const li = el('li', e.me ? 'me' : '');
        li.append(el('span', 'rk', String(e.rank)), el('span', 'nm', e.me ? `${e.name || t('lbAnon')} (${t('lbYou')})` : e.name || t('lbAnon')), el('span', 'sc', fmt(e.score)));
        list.append(li);
      }
      note.textContent = rows.length ? t('lbHow') : `${t('lbEmpty')} ${t('lbHow')}`;
    };
    bw.onclick = () => {
      board = 'week';
      void show();
    };
    bt.onclick = () => {
      board = 'total';
      void show();
    };
    login.onclick = async () => {
      login.disabled = true;
      await src.login();
      login.disabled = false;
      void show();
    };
    modal.hidden = false;
    await show();
    return new Promise<void>((resolve) => {
      const close = () => {
        token++;
        modal.hidden = true;
        resolve();
      };
      $('#lb-close').onclick = close;
      modal.onclick = (e) => {
        if (e.target === modal) close();
      };
    });
  }
}
