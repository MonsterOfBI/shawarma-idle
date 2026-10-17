// Интерфейс поверх сцены: шапка с деньгами и бафами, боковые кнопки, пять вкладок
// (улучшения, брейнроты, задания, переезд, магазин), окна подарка, офлайн-дохода и открытия ящика.
// Обычный HTML и CSS: так проще делать прокрутку и раскладку под телефон и компьютер.

import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from './core/achievements';
import { DAILY, canClaimDaily, dayKey, nextDailyIndex } from './core/daily';
import {
  type BuyMode,
  type GameState,
  adBoxReady,
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
  nextLocation,
  nextMilestone,
  MILESTONES,
  tapValue,
} from './core/economy';
import { formatDuration, formatNumber } from './core/format';
import { LOCATIONS } from './core/locations';
import { BOX_ODDS, type BoxKind, type Drop, PET_RARITY, RARITIES, type Rarity, petBonus, petMult } from './core/pets';
import { questDone, questProgress, counter } from './core/quests';
import { UPGRADES } from './core/upgrades';
import { lang, t } from './i18n';
import { awardIcon, icon, ui } from './icons';
import type { Product, ProductId } from './platform/platform';

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
  /** сколько пикселей справа закрыла шторка (на ПК), чтобы сцена сдвинула ларёк */
  sheet(inset: number): void;
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
}

interface PetCard {
  root: HTMLElement;
  img: HTMLImageElement;
  name: HTMLElement;
  bonus: HTMLElement;
  lv: HTMLElement;
  mut: HTMLElement;
  key: string;
}

export class Ui {
  private rows = new Map<string, Row>();
  private medals = new Map<string, HTMLElement>();
  private petCards = new Map<string, PetCard>();
  private portraits: Record<string, string> = {};
  private products: Product[] = [];
  private purchasesAvailable = false;
  private moveArmed = false;
  private tab: Tab = 'upgrades';
  private open = false;
  private mode: BuyMode = 'x1';
  private shownMoney = -1;
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
      this.rows.set(u.id, { root, icon: ic, lv, name, desc, ms, msBar, msText, btn, lastLevel: -1 });
    }

    // брейнроты
    $('#h-pets').textContent = t('hPets');
    $('#box-name').textContent = t('boxName');
    $('#gbox-name').textContent = t('gboxName');
    const sum = (k: BoxKind, from: Rarity) => RARITIES.slice(RARITIES.indexOf(from)).reduce((a, r) => a + BOX_ODDS[k][r], 0);
    $('#box-odds').textContent = t('boxOdds', Math.round(sum('common', 'epic')));
    $('#gbox-odds').textContent = t('gboxOdds', Math.round(sum('golden', 'legendary')));
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
      root.append(img, name, rar, bonus, lv, mut);
      root.addEventListener('click', () => {
        if (this.lastState?.pets[id]) this.toast(`${t(`br_${id}`)}: «${t(`brs_${id}`)}»`);
      });
      grid.append(root);
      this.petCards.set(id, { root, img, name, bonus, lv, mut, key: '' });
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
    $('#panel-close').setAttribute('aria-label', t('close'));
    $('#panel-close').addEventListener('click', () => this.closePanel());
    // клавиша Esc тоже закрывает шторку
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closePanel(); });
    this.syncPanel();
  }

  /** Открыть вкладку в шторке. Повторное нажатие на открытую вкладку прячет шторку. */
  showTab(id: Tab) {
    if (this.open && this.tab === id) return this.closePanel();
    this.tab = id;
    this.open = true;
    this.syncPanel();
  }

  closePanel() {
    if (!this.open) return;
    this.open = false;
    this.syncPanel();
  }

  private syncPanel() {
    const panel = $('#panel');
    panel.classList.toggle('open', this.open);
    panel.setAttribute('aria-hidden', String(!this.open));
    $('#app').classList.toggle('sheet-open', this.open);
    for (const x of TABS) {
      $(`#tab-${x}`).setAttribute('aria-selected', String(this.open && x === this.tab));
      $(`#panel-${x}`).hidden = x !== this.tab;
    }
    const side = window.matchMedia('(min-aspect-ratio: 1/1) and (min-width: 700px)').matches;
    this.actions.sheet(this.open && side ? Math.min(420, window.innerWidth * 0.42) + 12 : 0);
    if (this.lastState) this.render(this.lastState, Date.now());
  }

  private syncMode() {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#buy-mode button')) b.setAttribute('aria-checked', String(b.dataset.mode === this.mode));
  }

  setPortraits(map: Record<string, string>) {
    this.portraits = map;
    for (const [id, src] of Object.entries(map)) {
      const c = this.petCards.get(id);
      if (c) c.img.src = src;
    }
  }

  // Большая карточка при переезде на новую точку.
  moveCard(locId: string, mult: number) {
    $('#move-card-kicker').textContent = t('moveCard');
    $('#move-card-name').textContent = t(`loc_${locId}`);
    $('#move-card-desc').textContent = t(`locd_${locId}`);
    $('#move-card-mult').textContent = t('moveCardMult', mult);
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
    $('#place').textContent = t(`loc_${LOCATIONS[s.location].id}`);
    $('#hint').hidden = s.taps > 5;
    $('#sound').innerHTML = ui(s.muted ? 'mute' : 'sound');
    $('#sound').classList.toggle('off', s.muted);
    $('#music').classList.toggle('off', s.musicOff || s.muted);
    // боковые кнопки держим под шапкой
    const hud = $('#hud');
    $('#stage').style.setProperty('--side-top', `${hud.offsetTop + hud.offsetHeight + 34}px`);

    this.renderBuffs(s, now);
    this.renderSide(s, now);
    this.renderBadges(s, now);

    if (!this.open) return;
    if (this.tab === 'upgrades') this.renderUpgrades(s, now);
    if (this.tab === 'pets') this.renderPets(s, now);
    if (this.tab === 'quests') this.renderQuests(s, now);
    if (this.tab === 'move') this.renderMove(s);
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
    $('#adbox-label').textContent = adReady ? t('sideBox') : formatDuration((s.adBoxAt - now) / 1000, lang());
  }

  private renderBadges(s: GameState, now: number) {
    const set = (tab: Tab, text: string) => {
      const b = $(`#tab-${tab}`).querySelector('.badge') as HTMLElement;
      b.hidden = !text || (this.open && this.tab === tab);
      b.textContent = text;
    };
    const canUp = UPGRADES.some((u) => isVisible(s, u) && !isMaxed(s, u) && canBuyN(s, u.id, 1));
    set('upgrades', canUp ? '!' : '');
    set('pets', canBuyBox(s, now) || adBoxReady(s, now) ? '!' : '');
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
        void row.root.offsetWidth;
        row.root.classList.add('flash');
      }
      row.lastLevel = lv;
      row.lv.hidden = lv === 0 || u.kind === 'mult';
      row.lv.textContent = String(lv);
      row.name.textContent = t(`up_${u.id}`);
      if (u.kind === 'tap') {
        const after = tapValue({ ...s, levels: { ...s.levels, [u.id]: lv + 1 } }, now);
        row.desc.textContent = t('tapPlus', fmt(after - tapValue(s, now)));
      } else if (u.kind === 'helper') {
        const after = incomePerSecond({ ...s, levels: { ...s.levels, [u.id]: lv + 1 } }, now);
        row.desc.textContent = t('secPlus', fmt(after - incomePerSecond(s, now)));
      } else {
        row.desc.textContent = t(u.target === 'tap' ? 'multTap' : 'multAll', u.amount);
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
      row.btn.disabled = maxed || !canBuyN(s, u.id, n);
      const pulse = fresh && !pulsed && !row.btn.disabled;
      if (pulse) pulsed = true;
      row.btn.classList.toggle('pulse', pulse);
    }
  }

  private renderPets(s: GameState, now: number) {
    const owned = Object.keys(s.pets).filter((id) => PET_RARITY[id]).length;
    $('#pets-count').textContent = t('petsCount', owned);
    const buy = $<HTMLButtonElement>('#box-buy');
    buy.textContent = `${fmt(boxCost(s, now))} ₽`;
    buy.disabled = !canBuyBox(s, now);
    const g = $<HTMLButtonElement>('#gbox-buy');
    const ready = adBoxReady(s, now);
    g.disabled = !ready;
    g.textContent = ready ? t('boxFree') : t('boxWait', formatDuration((s.adBoxAt - now) / 1000, lang()));
    const banner = $('#pet-bonus');
    if (!owned) banner.textContent = t('petsHint');
    else banner.innerHTML = `${t('petBonusLabel')} <b>+${pct(petMult(s) - 1)} %</b>`;
    for (const id of PET_IDS) {
      const c = this.petCards.get(id)!;
      const p = s.pets[id];
      const key = p ? `${p.count}:${p.mut}` : '';
      if (key === c.key) continue;
      const wasUnknown = !c.key;
      c.key = key;
      c.root.classList.toggle('unknown', !p);
      c.root.classList.remove('m-1', 'm-2');
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
      c.lv.textContent = t('level', p.count);
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
    const next = can ? nextDailyIndex(s, today(-1)) : -1;
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
    $('#daily-streak').textContent = t('dailyStreak', can ? nextDailyIndex(s, today(-1)) : s.daily.streak);
    const claim = $<HTMLButtonElement>('#daily-claim');
    claim.disabled = !can;
    claim.textContent = can ? t('dailyClaim') : t('dailyTaken');

    const box = $('#quests');
    const key = s.quests.map((q) => `${q.kind}${q.target}${q.start}`).join();
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
      );
    }
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

  private renderMove(s: GameState) {
    const cur = LOCATIONS[s.location];
    const next = nextLocation(s);
    $('#move-now').textContent = t('moveNow', t(`loc_${cur.id}`));
    $('#move-mult').textContent = t('moveMult', cur.mult);
    [...$('#route').children].forEach((stop, i) => {
      stop.classList.toggle('passed', i < s.location);
      stop.classList.toggle('here', i === s.location);
    });
    const box = $('#move-next');
    if (!next) {
      box.hidden = true;
      $('#move-done').hidden = false;
      $('#move-done').textContent = t('moveDone');
      return;
    }
    box.hidden = false;
    $('#move-done').hidden = true;
    $('#move-next-name').textContent = t(`loc_${next.id}`);
    $('#move-next-desc').textContent = t(`locd_${next.id}`);
    const p = Math.min(1, s.runEarned / next.threshold);
    $('#move-bar').style.width = `${(p * 100).toFixed(1)}%`;
    $('#move-progress').textContent = t('moveProgress', `${fmt(s.runEarned)} / ${fmt(next.threshold)} ₽`);
    $('#move-warn').textContent = t('moveWarn', Math.round(next.mult / cur.mult));
    const btn = $<HTMLButtonElement>('#move-btn');
    btn.disabled = !canRelocate(s);
    if (!this.moveArmed) btn.textContent = t('moveBtn');
  }

  private renderShop(s: GameState, now: number) {
    const box = $('#shop');
    const items: { id: ProductId; ico: string; name: string; text: string; owned: boolean; hot?: boolean }[] = [
      { id: 'x2_forever', ico: 'x2', name: t('shopX2'), text: t('shopX2Text'), owned: s.owned.x2Forever, hot: true },
      { id: 'no_ads', ico: 'play', name: t('shopNoAds'), text: t('shopNoAdsText'), owned: s.owned.noAds },
      { id: 'cash_pack', ico: 'bag', name: t('shopCash'), text: t('shopCashText', fmt(cashPackAmount(s, now))), owned: false },
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
  async reveal(drop: Drop, kind: BoxKind, again: string | null, onOpen: () => void): Promise<'again' | 'ok'> {
    const box = $('#reveal');
    const crate = box.querySelector('.reveal-crate') as HTMLElement;
    crate.classList.toggle('gold', kind === 'golden');
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
    info.textContent = [drop.isNew ? t('petNew') : t('petUp', drop.level), drop.mut ? t(`mut_${drop.mut}`) : ''].filter(Boolean).join(' · ');
    const p = this.lastState?.pets[drop.id];
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
}
