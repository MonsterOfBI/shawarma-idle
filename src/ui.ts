// Интерфейс поверх сцены: деньги, вкладки, список улучшений, магазин, окна.
// Обычный HTML и CSS: так проще делать прокрутку и раскладку под телефон и компьютер.

import {
  type GameState,
  boostActive,
  canBuy,
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
import type { Product, ProductId } from './platform/platform';

export interface UiActions {
  buy(id: string): void;
  boost(): void;
  relocate(): void;
  purchase(id: ProductId): void;
  toggleSound(): void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const fmt = (n: number) => formatNumber(n, lang());

function el(tag: string, cls: string, text = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export class Ui {
  private rows = new Map<string, { root: HTMLElement; name: HTMLElement; desc: HTMLElement; btn: HTMLButtonElement }>();
  private products: Product[] = [];
  private purchasesAvailable = false;
  private moveArmed = false;
  private tab: 'upgrades' | 'move' | 'shop' = 'upgrades';

  constructor(private actions: UiActions) {
    document.title = t('title');
    $('#tab-upgrades').textContent = t('tabUpgrades');
    $('#tab-move').textContent = t('tabMove');
    $('#tab-shop').textContent = t('tabShop');
    $('#boost-label').textContent = t('boostBtn');
    $('#sound').setAttribute('aria-label', t('sound'));
    $('#hint').textContent = t('tapHint');

    for (const id of ['upgrades', 'move', 'shop'] as const) {
      $(`#tab-${id}`).addEventListener('click', () => this.showTab(id));
    }
    $('#boost').addEventListener('click', () => actions.boost());
    $('#sound').addEventListener('click', () => actions.toggleSound());
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
      const root = el('div', 'up');
      const info = el('div', 'up-info');
      const name = el('div', 'up-name');
      const desc = el('div', 'up-desc');
      info.append(name, desc);
      const btn = el('button', 'up-buy') as HTMLButtonElement;
      btn.type = 'button';
      btn.addEventListener('click', () => actions.buy(u.id));
      root.append(info, btn);
      list.append(root);
      this.rows.set(u.id, { root, name, desc, btn });
    }
    this.showTab('upgrades');
  }

  showTab(id: 'upgrades' | 'move' | 'shop') {
    this.tab = id;
    for (const x of ['upgrades', 'move', 'shop']) {
      $(`#tab-${x}`).setAttribute('aria-selected', String(x === id));
      $(`#panel-${x}`).hidden = x !== id;
    }
  }

  setProducts(products: Product[], available: boolean) {
    this.products = products;
    this.purchasesAvailable = available;
  }

  render(s: GameState, now: number) {
    $('#money').textContent = `${fmt(Math.floor(s.money))} ₽`;
    $('#rate').textContent = `${t('perSec', fmt(incomePerSecond(s, now)))} · ${t('perTap', fmt(tapValue(s, now)))}`;
    $('#place').textContent = t(`loc_${LOCATIONS[s.location].id}`);
    $('#hint').hidden = s.taps > 5;

    const boosting = boostActive(s, now);
    $('#boost').classList.toggle('active', boosting);
    $('#boost-label').textContent = boosting ? t('boostActive', formatDuration((s.boostUntil - now) / 1000, lang())) : t('boostBtn');
    $('#sound').textContent = s.muted ? '🔇' : '🔊';

    if (this.tab === 'upgrades') this.renderUpgrades(s, now);
    if (this.tab === 'move') this.renderMove(s);
    if (this.tab === 'shop') this.renderShop(s, now);
    $('#tab-move').classList.toggle('ready', canRelocate(s));
  }

  private renderUpgrades(s: GameState, now: number) {
    let shownLocked = false;
    for (const u of UPGRADES) {
      const row = this.rows.get(u.id)!;
      const visible = isVisible(s, u);
      // одно следующее закрытое улучшение показываем как «???», чтобы было куда стремиться
      row.root.hidden = !visible && shownLocked;
      if (!visible) {
        shownLocked = true;
        row.root.classList.add('locked');
        row.name.textContent = '???';
        row.desc.textContent = t('locked');
        row.btn.textContent = `${fmt(u.baseCost)} ₽`;
        row.btn.disabled = true;
        continue;
      }
      row.root.classList.remove('locked');
      const lv = level(s, u.id);
      row.name.textContent = u.kind === 'mult' ? t(`up_${u.id}`) : `${t(`up_${u.id}`)} · ${t('level', lv)}`;
      if (u.kind === 'tap') {
        const after = tapValue({ ...s, levels: { ...s.levels, [u.id]: lv + 1 } }, now);
        row.desc.textContent = t('tapPlus', fmt(after - tapValue(s, now)));
      } else if (u.kind === 'helper') {
        const after = incomePerSecond({ ...s, levels: { ...s.levels, [u.id]: lv + 1 } }, now);
        row.desc.textContent = t('secPlus', fmt(after - incomePerSecond(s, now)));
      } else {
        row.desc.textContent = t(u.target === 'tap' ? 'multTap' : 'multAll', u.amount);
      }
      if (isMaxed(s, u)) {
        row.btn.textContent = t('bought');
        row.btn.disabled = true;
      } else {
        row.btn.textContent = `${fmt(costOf(s, u))} ₽`;
        row.btn.disabled = !canBuy(s, u.id);
      }
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
    $('#move-need').textContent = t('moveNeed', fmt(next.threshold));
    const p = Math.min(1, s.runEarned / next.threshold);
    $('#move-bar').style.width = `${(p * 100).toFixed(1)}%`;
    $('#move-progress').textContent = t('moveProgress', `${fmt(s.runEarned)} / ${fmt(next.threshold)}`);
    $('#move-warn').textContent = t('moveWarn', Math.round(next.mult / cur.mult));
    const btn = $<HTMLButtonElement>('#move-btn');
    btn.disabled = !canRelocate(s);
    if (!this.moveArmed) btn.textContent = t('moveBtn');
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
      const note = el('p', 'shop-note');
      box.append(note);
      for (const it of items) {
        const card = el('div', 'up');
        card.dataset.id = it.id;
        const info = el('div', 'up-info');
        info.append(el('div', 'up-name'), el('div', 'up-desc'));
        const btn = el('button', 'up-buy') as HTMLButtonElement;
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
      (card.querySelector('.up-name') as HTMLElement).textContent = it.name;
      (card.querySelector('.up-desc') as HTMLElement).textContent = it.text;
      const btn = card.querySelector('button') as HTMLButtonElement;
      const price = this.products.find((p) => p.id === it.id)?.price;
      btn.textContent = it.owned ? t('shopOwned') : price ?? t('shopBuy');
      btn.disabled = it.owned || !this.purchasesAvailable || !price;
    }
  }

  toast(text: string) {
    const box = $('#toast');
    box.textContent = text;
    box.hidden = false;
    box.classList.remove('show');
    void box.offsetWidth;
    box.classList.add('show');
    clearTimeout((box as any)._t);
    (box as any)._t = setTimeout(() => (box.hidden = true), 2600);
  }

  // Окно «Пока вас не было». Возвращает множитель: 1 — забрать, 2 — за рекламу.
  offline(amount: number): Promise<'take' | 'double'> {
    $('#offline-title').textContent = t('offlineTitle');
    $('#offline-text').textContent = t('offlineText', fmt(amount));
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
