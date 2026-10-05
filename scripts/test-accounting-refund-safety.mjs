import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createAccounting } from '../server/accounting.ts';
import { emptyCosts, accountingDay, costSum } from '../src/utils/accounting.ts';

const env = { SESSION_SECRET: 'isolated-refund-safety-test-secret-more-than-32', NODE_ENV: 'test' };
const date = accountingDay();
let sequence = 0;
function fixture(stock = 1) {
  const store = new Store(env);
  store.set('market', 'gold', { pricePerGram: 24000000, isManualOverride: true });
  const app = createApp(store, env);
  const admin = [...store.map('users').values()].find(user => user.role === 'admin');
  const token = createAuthStore(store, env).createSessionToken(admin);
  const accounting = createAccounting(store);
  store.set('products', 'refund-fixture', { id: 'refund-fixture', title: 'کالای آزمایشی', stock, weight: 0, images: [] });
  const snapshot = () => accounting.snapshot();
  async function request(path, method, body) {
    const response = await app.fetch(new Request(`http://localhost${path}`, { method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
  }
  const mutation = (action, body) => request(`/api/admin/accounting/${action}`, 'POST', {
    ...body, actionId: `refund-safety-${++sequence}`, expectedRevision: snapshot().revision,
  });
  async function success(action, body) {
    const response = await mutation(action, body); assert.equal(response.status, 200, JSON.stringify(response.body)); return response.body.result;
  }
  const sale = (quantity = 1) => success('sale', { customerName: 'مشتری آزمایشی', items: [{ productId: 'refund-fixture', quantity, unitPrice: 1000 }], date });
  const pay = (saleId, quantity = 1) => success('money', { saleId, kind: 'receipt', amount: 1000 * quantity, method: 'card_to_card', fee: 0,
    note: 'رسید آزمایشی', reference: `PAY-${++sequence}`, date });
  return { store, accounting, snapshot, request, mutation, success, sale, pay };
}

// Both the accounting and normal order APIs must reject completion after a partial or full pre-delivery refund.
for (const amount of [200, 1000]) {
  const f = fixture(); const sale = await f.sale(); await f.pay(sale.id);
  await f.success('return', { saleId: sale.id, amount, shippingRefund: 0, items: [], restock: false,
    note: 'بازپرداخت قبل از تحویل', reference: `REF-${++sequence}`, date });
  const before = f.snapshot();
  assert.equal((await f.mutation('complete', { saleId: sale.id, date })).status, 409);
  assert.equal((await f.request(`/api/orders/${sale.id}/status`, 'PATCH', { status: 'تکمیل شده' })).status, 409);
  assert.equal(f.snapshot().sales.find(entry => entry.id === sale.id).recognizedAt, undefined);
  assert.equal(f.snapshot().report.revenue, before.report.revenue);
  assert.equal(f.store.get('products', 'refund-fixture').stock, 0, 'Failed completion cannot release held inventory');
  assert.equal((await f.request(`/api/orders/${sale.id}/status`, 'PATCH', { status: 'لغو شده' })).status, 200);
  assert.equal(f.store.get('products', 'refund-fixture').stock, 1);
  assert.equal((await f.request(`/api/orders/${sale.id}/status`, 'PATCH', { status: 'تأیید شده' })).status, 409, 'Refunded cancellation cannot reopen');
  const next = await f.sale(); await f.pay(next.id);
  await f.success('complete', { saleId: next.id, date });
  assert.ok(f.snapshot().sales.find(entry => entry.id === next.id).recognizedAt, 'A separately paid new order remains allowed');
}

// A site order must also be protected after its automatic approved-payment receipt is refunded.
{
  const f = fixture(0); const now = new Date().toISOString();
  const order = { id: 'site-refund-fixture', trackingCode: 'SITE-REFUND', customerName: 'مشتری سایت', status: 'تأیید شده',
    paymentMethod: 'card_to_card', paymentTrackingNumber: 'SITE-REFUND-PAY', reviewedAt: now, createdAt: now, inventoryReleased: false,
    totalPrice: 1000, items: [{ productId: 'refund-fixture', productTitle: 'کالا', quantity: 1, weight: 0, unitPrice: 1000, totalPrice: 1000 }] };
  f.store.set('orders', order.id, order); f.accounting.syncOrder(order);
  assert.equal(f.snapshot().totals[order.id].paid, 1000);
  await f.success('return', { saleId: order.id, amount: 1000, items: [], restock: false, note: 'بازپرداخت سایت', reference: 'SITE-REFUND', date });
  assert.equal((await f.request(`/api/orders/${order.id}/status`, 'PATCH', { status: 'تکمیل شده' })).status, 409);
  assert.throws(() => f.accounting.syncOrder({ ...order, status: 'تکمیل شده' }), error => error.statusCode === 409);
  assert.equal(f.snapshot().totals[order.id].paid, 1000, 'Sync must not invent another receipt after a refund');
}

// Ready-item assembly, assembly after ordering, and directly entered historical costs survive healthy returns.
for (const source of ['ready', 'after-order', 'direct']) {
  const f = fixture(); const components = { ...emptyCosts(), pearl: 300, assembly: source === 'after-order' ? 0 : 50 };
  if (source !== 'direct') await f.success('purchase', { productId: 'refund-fixture', kind: 'opening', quantity: 1, costs: components, date });
  const old = await f.sale(); await f.pay(old.id);
  await f.success('costs', { saleId: old.id, items: [{ key: '0', ...(source === 'direct' ? { costs: components } : {}), extraAssembly: source === 'after-order' ? 50 : 0 }],
    packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 });
  await f.success('complete', { saleId: old.id, date });
  assert.equal(f.snapshot().totals[old.id].cost, 350);
  const returned = await f.success('return', { saleId: old.id, amount: 1000, shippingRefund: 0, items: [{ key: '0', quantity: 1 }], restock: true,
    note: 'برگشت سالم', reference: `READY-RETURN-${++sequence}`, date });
  const lot = f.snapshot().purchases.find(entry => entry.reference === returned.reference);
  assert.deepEqual(lot.costs, { ...emptyCosts(), pearl: 300, assembly: 50 });
  const next = await f.sale(); await f.pay(next.id);
  const values = { saleId: next.id, packaging: 0, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 };
  await f.success('costs', { ...values, items: [{ key: '0', extraAssembly: 50 }] });
  assert.equal((await f.mutation('complete', { saleId: next.id, date })).status, 409, 'No duplicate assembly on returned ready item');
  assert.equal(f.snapshot().purchases.find(entry => entry.id === lot.id).remaining, 1, 'Rejected allocation rolls back');
  await f.success('costs', { ...values, items: [{ key: '0', extraAssembly: 0 }] });
  await f.success('complete', { saleId: next.id, date });
  assert.equal(f.snapshot().totals[next.id].cost, 350);
  assert.equal(f.snapshot().totals[next.id].profit, 650);
}

// Partial FIFO returns preserve each original lot's component costs across multiple return events.
{
  const f = fixture(2);
  const components = [{ ...emptyCosts(), gold: 100, making: 10, pearl: 200, assembly: 40 }, { ...emptyCosts(), gold: 150, making: 20, pearl: 300, assembly: 60 }];
  for (const costs of components) await f.success('purchase', { productId: 'refund-fixture', kind: 'opening', quantity: 1, costs, date });
  const old = await f.sale(2); await f.pay(old.id, 2); await f.success('complete', { saleId: old.id, date });
  const allocations = f.snapshot().sales.find(sale => sale.id === old.id).items[0].allocations;
  for (const allocation of allocations) {
    const original = f.snapshot().purchases.find(lot => lot.id === allocation.lotId);
    const returned = await f.success('return', { saleId: old.id, amount: 1000, items: [{ key: '0', quantity: 1 }], restock: true,
      note: 'برگشت یک قطعه', reference: `FIFO-RETURN-${++sequence}`, date });
    const lot = f.snapshot().purchases.find(lot => lot.reference === returned.reference);
    assert.deepEqual(lot.costs, original.costs); assert.equal(costSum(lot.costs), allocation.unitCost);
  }
  assert.equal(f.snapshot().report.inventoryCost, 880);
}
console.log('PASS: refunded completion/reopening blocked in both APIs, valid new sale allowed, site sync guarded, ready/direct/post-order assembly preserved, duplicate assembly rejected, rollback and exact partial FIFO return components.');
