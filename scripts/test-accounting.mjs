import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createAccounting } from '../server/accounting.ts';
import { accountingDay, accountingDate, emptyCosts, saleTotals, safeCsv } from '../src/utils/accounting.ts';

const env = { SESSION_SECRET: 'isolated-accounting-test-secret-more-than-32', NODE_ENV: 'test' };
const store = new Store(env); store.set('market', 'gold', { pricePerGram: 24000000, isManualOverride: true });
createApp(store, env);
const auth = createAuthStore(store, env);
const admin = [...store.map('users').values()].find(user => user.role === 'admin');
const token = auth.createSessionToken(admin);
const customer = { uid: 'accounting-customer', role: 'customer', phoneNumber: '09121111111', email: 'accounting-customer@example.test', displayName: 'مشتری', createdAt: new Date().toISOString() };
store.set('users', customer.email, customer); const customerToken = auth.createSessionToken(customer);
const getData = () => createAccounting(store).snapshot();
const date = accountingDay();
let counter = 0;
async function request(path, method = 'GET', body, access = token) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, body: await response.json() };
}
const mutate = (action, body, overrides = {}) => request(`/api/admin/accounting/${action}`, 'POST', { actionId: `accounting-test-${++counter}`, expectedRevision: getData().revision, ...body, ...overrides });
for (const action of ['settings', 'sync', 'purchase', 'purchase-correction', 'money-void', 'sale', 'costs', 'complete', 'money', 'return']) {
  assert.equal((await request(`/api/admin/accounting/${action}`, 'POST', {}, null)).status, 401);
  assert.equal((await request(`/api/admin/accounting/${action}`, 'POST', {}, customerToken)).status, 403);
}
assert.equal((await request('/api/admin/accounting', 'GET', undefined, null)).status, 401);
assert.equal((await request('/api/admin/accounting', 'GET', undefined, customerToken)).status, 403);
assert.equal(accountingDay('2026-10-04T21:00:00Z'), '1405/07/13', 'Dates use Tehran timezone');
assert.equal(accountingDay(accountingDate('۱۴۰۵/۰۷/۱۳')), '1405/07/13');
assert.throws(() => accountingDate('1405/12/30'));
assert.throws(() => accountingDate('1405/13/01'));
assert.match(safeCsv('=HYPERLINK("evil")'), /^"'/);

const product = [...store.map('products').values()].find(product => product.pricingMode === 'fixed');
product.stock = 2; store.set('products', product.id, product);
const components = { ...emptyCosts(), pearl: 300, assembly: 50 };
assert.equal((await mutate('settings', { packaging: 20, assembly: 50 })).status, 200);
const purchase = await mutate('purchase', { kind: 'opening', productId: product.id, quantity: 2, costs: components, date });
assert.equal(purchase.status, 200); assert.equal(store.get('products', product.id).stock, 2, 'Opening cost must not add stock');
assert.equal((await mutate('purchase-correction', { purchaseId: purchase.body.result.id, costs: components, reason: 'ثبت دقیق فاکتور' })).status, 200);
assert.equal((await mutate('purchase', { kind: 'opening', productId: product.id, quantity: 1, costs: components, date })).status, 409);
assert.equal((await mutate('purchase', { kind: 'purchase', productId: product.id, quantity: -1, costs: components, date })).status, 400);
const beforeStock = store.get('products', product.id).stock;
assert.equal((await mutate('sale', { items: [{ productId: product.id, quantity: 100, unitPrice: 500 }], customerName: 'مشتری تست', date })).status, 409);
assert.equal(store.get('products', product.id).stock, beforeStock);
const saleResult = await mutate('sale', { items: [{ productId: product.id, quantity: 1, unitPrice: 500 }], customerName: 'مشتری اینستاگرام', date });
assert.equal(saleResult.status, 200); const saleId = saleResult.body.result.id;
assert.equal(store.get('products', product.id).stock, 1, 'Instagram shares catalog inventory');
assert.equal((await mutate('costs', { saleId, items: [], packaging: 20, shippingReceived: 40, shippingPaid: 40, otherCosts: 0 })).status, 200);
assert.equal((await mutate('complete', { saleId, date })).status, 409, 'Unpaid manual sale cannot be completed');
const payBody = { actionId: 'stable-payment-0001', expectedRevision: getData().revision, saleId, kind: 'receipt', amount: 540, fee: 0, method: 'pasargad', note: 'پرداخت مشتری', reference: 'PASARGAD-ONE', date };
const pay = await request('/api/admin/accounting/money', 'POST', payBody);
assert.equal(pay.status, 200);
assert.equal((await request('/api/admin/accounting/money', 'POST', payBody)).status, 200, 'Exact retry must return original entry');
assert.equal(getData().money.length, 1);
assert.equal((await request('/api/admin/accounting/money', 'POST', { ...payBody, amount: 10 })).status, 409, 'Retry cannot change amount');
assert.equal((await mutate('money', { ...payBody, amount: 1, actionId: 'different-payment-id' }, { expectedRevision: getData().revision })).status, 409, 'Same bank reference cannot be duplicated');
assert.equal((await mutate('money', { saleId, kind: 'settlement', amount: 535, fee: 5, method: 'pasargad', note: 'تسویه', reference: 'SETTLEMENT-ONE', date })).status, 200);
assert.equal((await mutate('complete', { saleId, date })).status, 200);
let totals = getData().totals[saleId];
assert.equal(totals.cost, 350); assert.equal(totals.profit, 125); assert.equal(totals.pendingSettlement, 0);
assert.equal((await mutate('purchase-correction', { purchaseId: purchase.body.result.id, costs: components, reason: 'تغییر' })).status, 409, 'Consumed purchase costs cannot rewrite old profit');
assert.equal(getData().report.inventoryCost, 350);
assert.equal((await request(`/api/orders/${saleId}/status`, 'PATCH', { status: 'لغو شده' })).status, 409, 'Physical returns must use the financial return flow');
assert.equal((await mutate('costs', { saleId, items: [{ key: '0', extraAssembly: 50 }], packaging: 20, shippingReceived: 40, shippingPaid: 40, otherCosts: 0, reason: 'اصلاح' })).status, 409, 'Fabrication cost cannot be added twice');
assert.equal((await mutate('return', { saleId, amount: 1000, shippingRefund: 0, items: [{ key: '0', quantity: 1 }], restock: true, reference: 'RET-FAIL', note: 'مرجوعی', date })).status, 409);
const ret = await mutate('return', { saleId, amount: 540, shippingRefund: 40, items: [{ key: '0', quantity: 1 }], restock: true, reference: 'RETURN-ONE', note: 'مرجوعی کامل', date });
assert.equal(ret.status, 200);
totals = getData().totals[saleId];
assert.equal(totals.revenue, 0); assert.equal(totals.cost, 0); assert.equal(totals.profit, -65, 'Nonrefundable packaging, shipping and gateway fee survive return');
assert.equal(store.get('products', product.id).stock, 2); assert.equal(getData().report.inventoryCost, 700);
assert.equal((await request(`/api/orders/${saleId}/status`, 'PATCH', { status: 'تأیید شده' })).status, 409, 'Returned orders cannot resurrect the old sale');
assert.equal((await mutate('money-void', { entryId: pay.body.result.id, reason: 'تغییر' })).status, 409, 'Refund-backed receipt cannot be voided');
assert.equal((await mutate('return', { saleId, amount: 1, items: [{ key: '0', quantity: 1 }], restock: true, reference: 'RETURN-TWO', note: 'تکراری', date })).status, 409);
assert.equal((await request(`/api/orders/${saleId}`, 'DELETE')).status, 200);
assert.ok(getData().sales.find(sale => sale.id === saleId), 'Deleting the admin order must preserve financial history');
assert.equal(getData().totals[saleId].profit, -65);

// New purchase costs preserve the old sale snapshot. Opening inventory never reduces profit.
const fresh = await mutate('purchase', { kind: 'purchase', productId: product.id, quantity: 1, costs: { ...components, pearl: 900 }, date });
assert.equal(fresh.status, 200); assert.equal(getData().totals[saleId].cost, 0);
assert.equal(store.get('products', product.id).stock, 3);
const knownProfit = getData().report.profit;
await mutate('money', { kind: 'capital', amount: 5000, method: 'card_to_card', note: 'سرمایه', date });
await mutate('money', { kind: 'withdrawal', amount: 1000, method: 'card_to_card', note: 'برداشت', date });
assert.equal(getData().report.profit, knownProfit, 'Capital and owner draws must not change profit');
const expense = await mutate('money', { kind: 'expense', amount: 25, method: 'card_to_card', note: 'تبلیغات', category: 'تبلیغات', date });
assert.equal(getData().report.profit, knownProfit - 25);
assert.equal((await mutate('money-void', { entryId: expense.body.result.id, reason: 'ثبت تکراری اشتباه' })).status, 200);
assert.equal(getData().report.profit, knownProfit);
assert.ok(getData().money.find(entry => entry.id === expense.body.result.id).voidedAt, 'Voided entry remains in the audit trail');

// Missing historical costs stay unknown until entered, rather than reading selling pearlPrice.
store.set('orders', 'legacy', { id: 'legacy', trackingCode: 'LEGACY', status: 'تکمیل شده', customerName: 'قدیمی', totalPrice: 1000, createdAt: new Date().toISOString(), items: [{ productId: 'absent-cost-product', productTitle: 'محصول قدیمی', quantity: 1, weight: 0, unitPrice: 1000, totalPrice: 1000 }] });
assert.equal((await mutate('sync', {})).status, 200);
assert.equal(getData().totals.legacy.profit, null); assert.equal(getData().report.profit, null);
assert.equal((await mutate('costs', { saleId: 'legacy', items: [{ key: '0', costs: { ...emptyCosts(), pearl: 600 }, extraAssembly: 0 }], packaging: 20, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 })).status, 200);
assert.equal(getData().totals.legacy.profit, 380); assert.notEqual(getData().report.profit, null);
assert.equal((await mutate('sync', {})).status, 200); assert.equal(getData().totals.legacy.profit, 380, 'Repeated sync must not recost sales');
const publicProducts = (await request('/api/products', 'GET', undefined, customerToken)).body;
assert.ok(publicProducts.every(product => !('purchaseCosts' in product) && !('accounting' in product)));
const publicOrder = (await request('/api/orders/legacy', 'GET', undefined, customerToken));
assert.equal(publicOrder.status, 403);

// Explicit dates make prior-period returns affect the return month, not the original sale month.
const periodStore = new Store(env); const acc = createAccounting(periodStore);
const old = { id: 'period', trackingCode: 'PERIOD', customerName: 'قدیمی', createdAt: accountingDate('1405/06/01'), reviewedAt: accountingDate('1405/06/01'), status: 'تکمیل شده', totalPrice: 500, items: [{ productId: 'x', productTitle: 'x', weight: 0, unitPrice: 500, quantity: 1, totalPrice: 500 }] };
acc.syncOrder(old);
const event = (action, body) => acc.mutate(action, { ...body, actionId: `period-event-${++counter}`, expectedRevision: acc.snapshot().revision }, 'admin');
event('costs', { saleId: 'period', items: [{ key: '0', costs: { ...emptyCosts(), pearl: 300 } }], packaging: 20, shippingReceived: 0, shippingPaid: 0, otherCosts: 0 });
event('money', { kind: 'receipt', saleId: 'period', method: 'card_to_card', amount: 500, fee: 0, note: 'دریافت', reference: 'PERIOD-RECEIPT', date: '1405/06/01' });
event('return', { saleId: 'period', items: [{ key: '0', quantity: 1 }], restock: false, amount: 500, shippingRefund: 0, note: 'مرجوعی آسیب‌دیده', reference: 'PERIOD-RETURN', date: '1405/07/01' });
assert.equal(acc.snapshot('1405/06/01', '1405/06/31').report.profit, 180);
assert.equal(acc.snapshot('1405/07/01', '1405/07/30').report.profit, -500);
assert.equal(acc.snapshot().report.profit, -320, 'Damaged returns retain their cost loss');

// A two-piece sale bought at different integer costs must return exact FIFO cost layers.
const mixStore = new Store(env); const mix = createAccounting(mixStore);
mixStore.set('products', 'mixed', { id: 'mixed', title: 'دو قطعه', weight: 0, stock: 2 });
const mixEvent = (action, body) => mix.mutate(action, { ...body, actionId: `mixed-event-${++counter}`, expectedRevision: mix.snapshot().revision }, 'admin');
mixEvent('purchase', { productId: 'mixed', kind: 'opening', quantity: 1, costs: { ...emptyCosts(), pearl: 100 }, date });
mixEvent('purchase', { productId: 'mixed', kind: 'opening', quantity: 1, costs: { ...emptyCosts(), pearl: 101 }, date });
const two = mixEvent('sale', { customerName: 'دو قطعه', items: [{ productId: 'mixed', quantity: 2, unitPrice: 200 }], date });
mixEvent('money', { saleId: two.id, kind: 'receipt', amount: 400, fee: 0, method: 'card_to_card', note: 'دریافت', reference: 'MIX-RECEIPT', date });
mixEvent('complete', { saleId: two.id, date });
const firstAllocation = mix.snapshot().sales[0].items[0].allocations[0].unitCost;
mixEvent('return', { saleId: two.id, amount: 200, shippingRefund: 0, items: [{ key: '0', quantity: 1 }], restock: true, note: 'یک عدد', reference: 'MIX-RETURN', date });
assert.equal(mix.snapshot().totals[two.id].cost, 201 - firstAllocation);
assert.equal(mix.snapshot().report.inventoryCost, firstAllocation);
assert.ok(mix.snapshot().purchases.every(lot => Number.isSafeInteger(lot.costs.other)), 'Partial returns must not introduce fractional Toman costs');
assert.throws(() => mix.snapshot('1405/07/31', '1405/08/01'));
console.log('PASS: admin-only API, opening/purchase inventory, FIFO snapshots, shared Instagram stock, missing costs, payment retry/deduplication, Pasargad settlement, returns, preserved history, owner cash flows and Tehran period reports.');
