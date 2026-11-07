import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkLaunch, handlePayment, paymentSig } from './_vk';

const SECRET = 'test-secret';
const signed = (p: Record<string, string>) => ({ ...p, sig: paymentSig(p, SECRET) });

describe('VK: платежи', () => {
  it('отдаёт товар по запросу get_item', () => {
    const r = handlePayment(signed({ notification_type: 'get_item', item: 'no_ads', app_id: '1', user_id: '2' }), SECRET) as { response: { price: number; item_id: string } };
    expect(r.response.item_id).toBe('no_ads');
    expect(r.response.price).toBe(14);
  });
  it('подтверждает оплаченный заказ', () => {
    const r = handlePayment(signed({ notification_type: 'order_status_change_test', status: 'chargeable', order_id: '777', item: 'cash_pack' }), SECRET);
    expect(r).toEqual({ response: { order_id: 777, app_order_id: 777 } });
  });
  it('отклоняет чужую подпись и неизвестный товар', () => {
    expect(handlePayment({ notification_type: 'get_item', item: 'no_ads', sig: 'bad' }, SECRET)).toMatchObject({ error: { error_code: 10 } });
    expect(handlePayment(signed({ notification_type: 'get_item', item: 'nope' }), SECRET)).toMatchObject({ error: { error_code: 20 } });
  });
});

describe('VK: параметры запуска', () => {
  const sign = (p: Record<string, string>) =>
    createHmac('sha256', SECRET).update(new URLSearchParams(Object.entries(p).sort()).toString()).digest('base64url');
  const params = { vk_app_id: '123', vk_user_id: '42', vk_language: 'ru', vk_ts: '1700000000' };
  it('принимает настоящую подпись', () => {
    const q = new URLSearchParams({ ...params, sign: sign(params), extra: 'x' }).toString();
    expect(checkLaunch(`?${q}`, SECRET)).toBe('42');
  });
  it('отклоняет подделку', () => {
    const q = new URLSearchParams({ ...params, vk_user_id: '43', sign: sign(params) }).toString();
    expect(checkLaunch(q, SECRET)).toBeNull();
    expect(checkLaunch(q, '')).toBeNull();
  });
});
