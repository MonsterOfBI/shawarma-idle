// Интерфейс поверх сцены: деньги, вкладки, меню улучшений, переезд, награды, магазин, окна.
// Обычный HTML и CSS: так проще делать прокрутку и раскладку под телефон и компьютер.

import { ACHIEVEMENTS, ACHIEVEMENT_BONUS } from './core/achievements';
import { BRAINROTS } from './core/brainrots';
import {
  type BuyMode,
  type GameState,
  boostActive,
  bulkAmount,
  bulkCost,
  canBuyN,
  canRelocate,
  cashPackAmount,
  costOf,
  incomePerSecond,
  isMaxed,
  isVisible,
  level,
  nextLocation,
  tapValue,
} from './core/economy';
import { formatDuration, formatNumber } from './core/format';
import { LOCATIONS } from './core/locations';
import { UPGRADES } from './core/upgrades';
import { lang, t } from './i18n';
import { awardIcon, icon } from './icons';
import type { Product, ProductId } from './platform/platform';

export interface UiActions {
  buy(id: string, n: number): void;
  toggleMusic(): void;
  boost(): void;
  relocate(): void;
  purchase(id: ProductId): void;
  toggleSound(): void;
}

type Tab = 'upgrades' | 'move' | 'awards' | 'shop';
const TABS: Tab[] = ['upgrades', 'move', 'awards', 'shop'];

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const fmt = (n: number) => formatNumber(n, lang());

function el(tag: string, cls: string, text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

interface Row {
  root: HTMLElement;
  icon: HTMLElement;
  lv: HTMLElement;
  name: HTMLElement;
  desc: HTMLElement;
  btn: HTMLButtonElement;
  lastLevel: number;
}

export class Ui {
  private rows = new Map<string, Row>();
  private medals = new Map<string, HTMLElement>();
  private products: Product[] = [];
  private purchasesAvailable = false;
  private moveArmed = false;
  private tab: Tab = 'upgrades';
  private mode: BuyMode = 'x1';
  private shownMoney = -1;
  private cards = new Map<string, HTMLElement>();
  private metKnown = new Set<string>();
  private lastState?: GameState;

  constructor(private actions: UiActions) {
    document.title = t('title');
    $('#tab-upgrades').textContent = t('tabUpgrades');
    $('#tab-move').textContent = t('tabMove');
    $('#tab-awards').textContent = t('tabAwards');
    $('#tab-shop').textContent = t('tabShop');
    $('#boost-label').textContent = t('boostBtn');
    $('#sound').setAttribute('aria-label', t('sound'));
    $('#hint').textContent = t('tapHint');
    $('#rush-title').textContent = t('rushTitle');
    $('.loading span')?.replaceChildren(t('title'));

    for (const id of TABS) $(`#tab-${id}`).addEventListener('click', () => this.showTab(id));
    $('#boost').addEventListener('click', () => actions.boost());
    $('#sound').addEventListener('click', () => actions.toggleSound());
    $('#music').addEventListener('click', () => actions.toggleMusic());
    $('#music').setAttribute('aria-label', t('music'));
    $('#coll-title').textContent = t('collTitle');
    $('#coll-note').textContent = t('collHint');
    $('#ach-title').textContent = t('achTitle');
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

    const list = $('#upgrades');
    for (const u of UPGRADES) {
      const root = el('div', 'item');
      const ic = el('div', 'item-icon');
      const lv = el('span', 'item-lv');
      ic.append(lv);
      const info = el('div', 'item-info');
      const name = el('div', 'item-name');
      const desc = el('div', 'item-desc');
      info.append(name, desc);
      const btn = el('button', 'sticker') as HTMLButtonElement;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        if (this.lastState) actions.buy(u.id, bulkAmount(this.lastState, u, this.mode));
      });
      root.append(ic, info, btn);
      list.append(root);
      this.rows.set(u.id, { root, icon: ic, lv, name, desc, btn, lastLevel: -1 });
    }

    const coll = $('#collection');
    for (const b of BRAINROTS) {
      const card = el('button', 'card unknown') as HTMLButtonElement;
      card.type = 'button';
      const img = document.createElement('img');
      img.alt = '';
      card.append(img, el('b', '', '???'));
      if (b.role !== 'customer') card.append(el('i', '', b.role === 'staff' ? '★' : '✈'));
      card.addEventListener('click', () => {
        if (this.metKnown.has(b.id)) this.toast(`${t(`br_${b.id}`)}: «${t(`brs_${b.id}`)}»`);
      });
      coll.append(card);
      this.cards.set(b.id, card);
    }

    const awards = $('#awards');
    for (const a of ACHIEVEMENTS) {
      const m = el('div', 'medal');
      const disc = el('div', 'medal-disc');
      disc.innerHTML = awardIcon(a.id);
      m.append(disc, el('div', 'medal-name', t(`ach_${a.id}`)), el('div', 'medal-desc', t(`achd_${a.id}`)));
      awards.append(m);
      this.medals.set(a.id, m);
    }
    this.showTab('upgrades');
  }

  showTab(id: Tab) {
    this.tab = id;
    for (const x of TABS) {
      $(`#tab-${x}`).setAttribute('aria-selected', String(x === id));
      $(`#panel-${x}`).hidden = x !== id;
    }
  }

  private syncMode() {
    for (const b of document.querySelectorAll<HTMLButtonElement>('#buy-mode button')) b.setAttribute('aria-checked', String(b.dataset.mode === this.mode));
  }

  setPortraits(map: Record<string, string>) {
    for (const [id, src] of Object.entries(map)) {
      const img = this.cards.get(id)?.querySelector('img');
      if (img) img.src = src;
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

    const boosting = boostActive(s, now);
    $('#boost').classList.toggle('active', boosting);
    $('#boost-label').textContent = boosting ? t('boostActive', formatDuration((s.boostUntil - now) / 1000, lang())) : t('boostBtn');
    $('#sound').textContent = s.muted ? '🔇' : '🔊';
    $('#music').textContent = '♪';
    $('#music').classList.toggle('off', s.musicOff || s.muted);

    if (this.tab === 'upgrades') this.renderUpgrades(s, now);
    if (this.tab === 'move') this.renderMove(s);
    if (this.tab === 'awards') this.renderAwards(s);
    if (this.tab === 'shop') this.renderShop(s, now);
    $('#tab-move').classList.toggle('ready', canRelocate(s));
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
        row.name.textContent = '???';
        row.desc.textContent = t('locked');
        row.btn.textContent = `${fmt(u.baseCost)} ₽`;
        row.btn.disabled = true;
        row.btn.classList.remove('done');
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

  private renderMove(s: GameState) {
    const cur = LOCATIONS[s.location];
    const next = nextLocation(s);
    $('#move-now').textContent = t('moveNow', t(`loc_${cur.id}`));
    $('#move-mult').textContent = t('moveMult', cur.mult);
    const box = $('#move-next');
    if (!next) {
      box.hidden = true;
      $('#move-done').hidden = false;
      $('#move-done').textContent = t('moveDone');
      return;
    }
    box.hidden = false;
    $('#move-done').hidden = true;
    $('#move-next-name').textContent = t('moveNext', t(`loc_${next.id}`));
    $('#move-next-desc').textContent = t(`locd_${next.id}`);
    $('#move-need').textContent = t('moveNeed', fmt(next.threshold));
    const p = Math.min(1, s.runEarned / next.threshold);
    $('#move-bar').style.width = `${(p * 100).toFixed(1)}%`;
    $('#move-progress').textContent = t('moveProgress', `${fmt(s.runEarned)} / ${fmt(next.threshold)}`);
    $('#move-warn').textContent = t('moveWarn', Math.round(next.mult / cur.mult));
    const btn = $<HTMLButtonElement>('#move-btn');
    btn.disabled = !canRelocate(s);
    if (!this.moveArmed) btn.textContent = t('moveBtn');
  }

  private renderAwards(s: GameState) {
    const met = new Set(s.met);
    for (const b of BRAINROTS) {
      const card = this.cards.get(b.id)!;
      const known = met.has(b.id);
      if (known === !card.classList.contains('unknown')) continue;
      card.classList.toggle('unknown', !known);
      card.querySelector('b')!.textContent = known ? t(`br_${b.id}`) : '???';
      if (known && this.metKnown.size) {
        card.classList.remove('fresh');
        void card.offsetWidth;
        card.classList.add('fresh');
      }
    }
    this.metKnown = met;
    $('#coll-count').textContent = t('collCount', met.size);
    const got = new Set(s.achievements);
    $('#ach-count').textContent = t('achCount', got.size);
    const pct = Math.round(got.size * ACHIEVEMENT_BONUS * 100);
    const note = $('#awards-note');
    note.textContent = t('achBonus', pct);
    for (const a of ACHIEVEMENTS) {
      const m = this.medals.get(a.id)!;
      const has = got.has(a.id);
      m.classList.toggle('got', has);
      (m.firstElementChild as HTMLElement).style.setProperty('--p', String(has ? 1 : a.progress(s)));
    }
  }

  private renderShop(s: GameState, now: number) {
    const box = $('#shop');
    const items: { id: ProductId; name: string; text: string; owned: boolean }[] = [
      { id: 'x2_forever', name: t('shopX2'), text: t('shopX2Text'), owned: s.owned.x2Forever },
      { id: 'no_ads', name: t('shopNoAds'), text: t('shopNoAdsText'), owned: s.owned.noAds },
      { id: 'cash_pack', name: t('shopCash'), text: t('shopCashText', fmt(cashPackAmount(s, now))), owned: false },
    ];
    if (box.childElementCount !== items.length + 1) {
      box.replaceChildren();
      box.append(el('p', 'shop-note'));
      for (const it of items) {
        const card = el('div', 'coupon');
        card.dataset.id = it.id;
        const info = el('div', 'coupon-info');
        info.append(el('div', 'coupon-name'), el('div', 'coupon-desc'));
        const btn = el('button', 'sticker') as HTMLButtonElement;
        btn.type = 'button';
        btn.addEventListener('click', () => this.actions.purchase(it.id));
        card.append(info, btn);
        box.append(card);
      }
    }
    const note = box.querySelector('.shop-note') as HTMLElement;
    note.hidden = this.purchasesAvailable;
    note.textContent = t('shopUnavailable');
    for (const it of items) {
      const card = box.querySelector(`[data-id="${it.id}"]`) as HTMLElement;
      (card.querySelector('.coupon-name') as HTMLElement).textContent = it.name;
      (card.querySelector('.coupon-desc') as HTMLElement).textContent = it.text;
      const btn = card.querySelector('button') as HTMLButtonElement;
      const price = this.products.find((p) => p.id === it.id)?.price;
      btn.textContent = it.owned ? t('shopOwned') : price ?? t('shopBuy');
      btn.classList.toggle('done', it.owned);
      btn.disabled = it.owned || !this.purchasesAvailable || !price;
    }
  }

  toast(text: string, kind: 'plain' | 'medal' = 'plain') {
    const box = $('#toast');
    box.textContent = text;
    box.classList.toggle('medal-toast', kind === 'medal');
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
}
