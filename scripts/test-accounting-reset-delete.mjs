import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createAccounting, RESET_CONFIRMATION } from '../server/accounting.ts';
import { emptyCosts, accountingDay } from '../src/utils/accounting.ts';

const env = { SESSION_SECRET: 'isolated-accounting-reset-delete-secret', NODE_ENV: 'test' };
const store = new Store(env); store.set('market', 'gold', { pricePerGram: 24000000, isManualOverride: true }); createApp(store, env);
const auth = createAuthStore(store, env);
const adminToken = auth.createSessionToken([...store.map('users').values()].find(user => user.role === 'admin'));
const customer = { uid: 'reset-customer', role: 'customer', phoneNumber: '09121112222', email: 'reset-customer@users.inanagold.invalid', displayName: 'مشتری', createdAt: new Date().toISOString() };
store.set('users', customer.email, customer);
async function request(path, method = 'GET', body, token = adminToken) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, data: await response.json() };
}
const books = () => createAccounting(store).snapshot();
let actions = 0;
const mutation = (action, body, token) => request(`/api/admin/accounting/${action}`, 'POST', { actionId: `reset-delete-test-${++actions}`, expectedRevision: books().revision, ...body }, token);
const ok = async (action, body) => { const response = await mutation(action, body); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data.result; };
const day = accountingDay(), now = new Date().toISOString();
const product = (await request('/api/admin/products', 'POST', { title: 'کالای آزمون حذف', pricingMode: 'fixed', fixedPrice: 1000, stock: 10, images: ['/x.webp'] })).data;
const stock = () => store.get('products', product.id).stock;
function siteOrder(id, status) {
  store.set('orders', id, { id, trackingCode: id.toUpperCase(), userId: customer.uid, customerName: `مشتری ${id}`, customerPhone: customer.phoneNumber, customerAddress: 'نشانی آزمایشی کامل',
    contactMethod: 'phone', status, paymentMethod: 'card_to_card', paymentTrackingNumber: `TRK-${id}`, paymentDate: now, createdAt: now, reviewedAt: now, inventoryReleased: false,
    totalWeight: 0, totalPrice: 1000, items: [{ productId: product.id, productTitle: product.title, productImage: '', weight: 0, quantity: 1, unitPrice: 1000, totalPrice: 1000, goldPriceAtOrder: 0, makingChargePercent: 0 }] });
}
const sync = () => request('/api/admin/accounting/sync-site', 'POST');

// --- Deleting one sale -------------------------------------------------------
await ok('purchase', { kind: 'opening', productId: product.id, quantity: 3, costs: { ...emptyCosts(), pearl: 600 }, date: day });
const lotId = books().purchases[0].id;
const sale = await ok('sale', { customerName: 'فروش حذف‌شدنی', items: [{ productId: product.id, quantity: 2, unitPrice: 1000 }], date: day });
await ok('money', { kind: 'receipt', method: 'card_to_card', saleId: sale.id, amount: 2000, fee: 0, reference: 'DEL-PAY', note: 'دریافت', date: day });
await ok('complete', { saleId: sale.id, date: day });
await ok('return', { saleId: sale.id, amount: 1000, shippingRefund: 0, restock: true, items: [{ key: '0', quantity: 1 }], reference: 'DEL-RETURN', note: 'مرجوعی', date: day });
const keep = await ok('sale', { customerName: 'فروش ماندنی', items: [{ productId: product.id, quantity: 1, unitPrice: 1000 }], date: day });
let data = books();
assert.equal(data.purchases.find(lot => lot.id === lotId).remaining, 1, 'The sale consumed two pieces of the purchase');
assert.equal(data.purchases.filter(lot => lot.id.startsWith('return-')).length, 1);
const stockBefore = stock(), orderBefore = structuredClone(store.get('orders', sale.orderId));

assert.equal((await mutation('sale-delete', { saleId: sale.id, reason: 'x' }, auth.createSessionToken(customer))).status, 403, 'Customers cannot delete sales');
assert.equal((await mutation('sale-delete', { saleId: sale.id })).status, 400, 'A reason is required');
assert.equal((await mutation('sale-delete', { saleId: 'missing', reason: 'x' })).status, 404);
await ok('sale-delete', { saleId: sale.id, reason: 'ثبت اشتباه' });
data = books();
assert.equal(data.sales.find(entry => entry.id === sale.id), undefined);
assert.ok(data.sales.find(entry => entry.id === keep.id), 'Other sales are untouched');
assert.equal(data.money.filter(entry => entry.saleId === sale.id).length, 0, 'Its receipts go with it');
assert.equal(data.returns.filter(entry => entry.saleId === sale.id).length, 0);
assert.equal(data.purchases.filter(lot => lot.id.startsWith('return-')).length, 0, 'Its return lots go with it');
assert.equal(data.purchases.find(lot => lot.id === lotId).remaining, 3, 'Consumed purchase pieces are available again');
assert.equal(stock(), stockBefore, 'Shop stock is not changed');
assert.deepEqual(store.get('orders', sale.orderId), orderBefore, 'The order itself is not changed');
assert.ok(data.audit.some(entry => entry.action === 'sale-delete' && entry.target === sale.id), 'The deletion is recorded');
await sync(); await sync();
assert.equal(books().sales.find(entry => entry.id === sale.id), undefined, 'Synchronization never brings a deleted sale back');
// Saving the order again (as the orders panel does) does not re-enter it either.
assert.equal((await request(`/api/admin/orders/${sale.orderId}/archive`, 'PATCH', { archived: true })).status, 200, 'The order can still be handled');
await sync();
assert.equal(books().sales.find(entry => entry.id === sale.id), undefined);

// A sale whose returned piece was sold again cannot be deleted first.
const first = await ok('sale', { customerName: 'اول', items: [{ productId: product.id, quantity: 3, unitPrice: 1000 }], date: day });
await ok('money', { kind: 'receipt', method: 'card_to_card', saleId: first.id, amount: 3000, fee: 0, reference: 'CHAIN-PAY', note: 'دریافت', date: day });
await ok('complete', { saleId: first.id, date: day });
await ok('return', { saleId: first.id, amount: 1000, shippingRefund: 0, restock: true, items: [{ key: '0', quantity: 1 }], reference: 'CHAIN-RETURN', note: 'مرجوعی', date: day });
const second = await ok('sale', { customerName: 'دوم', items: [{ productId: product.id, quantity: 1, unitPrice: 1000 }], date: day });
await ok('money', { kind: 'receipt', method: 'card_to_card', saleId: second.id, amount: 1000, fee: 0, reference: 'CHAIN-PAY-2', note: 'دریافت', date: day });
await ok('complete', { saleId: second.id, date: day });
assert.equal((await mutation('sale-delete', { saleId: first.id, reason: 'x' })).status, 409);
assert.ok(books().sales.find(entry => entry.id === first.id), 'A refused deletion changes nothing');

// --- Starting the books from zero -------------------------------------------
siteOrder('reset-done', 'تکمیل شده'); siteOrder('reset-open', 'تأیید شده'); siteOrder('reset-rejected', 'رد شده');
await sync();
await ok('money', { kind: 'expense', method: 'card_to_card', amount: 500, fee: 0, note: 'هزینه', date: day });
await ok('settings', { packaging: 70, assembly: 90 });
data = books();
assert.ok(data.sales.length >= 5 && data.purchases.length && data.money.length && data.audit.length);
const productsBefore = JSON.stringify([...store.map('products').values()]), ordersBefore = JSON.stringify([...store.map('orders').values()]), usersBefore = store.map('users').size;

assert.equal((await mutation('reset', { confirm: RESET_CONFIRMATION, keepOpenOrders: true }, auth.createSessionToken(customer))).status, 403);
assert.equal((await mutation('reset', { confirm: 'بله', keepOpenOrders: true })).status, 400, 'The exact confirmation phrase is required');
assert.equal((await mutation('reset', { confirm: RESET_CONFIRMATION })).status, 400);
assert.ok(books().sales.length >= 5, 'A refused reset removes nothing');
await ok('reset', { confirm: RESET_CONFIRMATION, keepOpenOrders: true });
data = books();
assert.deepEqual([data.sales.length, data.purchases.length, data.money.length, data.returns.length], [0, 0, 0, 0]);
assert.deepEqual(data.audit.map(entry => entry.action), ['reset'], 'Only the reset itself remains in the history');
assert.deepEqual([data.report.revenue, data.report.cost, data.report.expenses, data.report.cashMovement, data.report.inventoryCost], [0, 0, 0, 0, 0]);
assert.deepEqual(data.settings, { packaging: 70, assembly: 90 }, 'Default cost settings are kept');
assert.equal(JSON.stringify([...store.map('products').values()]), productsBefore, 'Products and stock are untouched');
assert.equal(JSON.stringify([...store.map('orders').values()]), ordersBefore, 'Orders are untouched');
assert.equal(store.map('users').size, usersBefore);
assert.ok(data.catalog.find(row => row.id === product.id).unknownQuantity > 0, 'Stock waits for its purchase cost again');

await sync();
data = books();
assert.deepEqual(data.sales.map(entry => entry.id).sort(), [keep.id, 'reset-open'].sort(), 'Only orders still in progress (site and Instagram) enter the new books');
assert.equal(data.totals[keep.id].paid, 0, 'Manual receipts from before the reset are gone');
assert.equal(data.totals['reset-open'].paid, 1000, 'Its confirmed payment is recorded again');
// The books work normally afterwards.
await ok('purchase', { kind: 'opening', productId: product.id, quantity: 1, costs: { ...emptyCosts(), pearl: 400 }, date: day });
assert.equal((await request('/api/orders/reset-open/status', 'PATCH', { status: 'تکمیل شده' })).status, 200);
assert.equal(books().totals['reset-open'].profit, 530, 'Sale 1000 − purchase 400 − default packaging 70');
siteOrder('after-reset', 'تأیید شده'); await sync();
assert.ok(books().sales.find(entry => entry.id === 'after-reset'), 'New orders are entered as usual');

// Excluding the in-progress orders as well leaves nothing behind.
await ok('reset', { confirm: RESET_CONFIRMATION, keepOpenOrders: false });
await sync();
assert.equal(books().sales.length, 0);
console.log('PASS: one sale can be deleted from the books (purchases restored, order and stock untouched, never re-synced), and a confirmed reset empties accounting while keeping products, orders, users and settings.');
