import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createAccounting } from '../server/accounting.ts';
import { accountingDay } from '../src/utils/accounting.ts';

const env = { SESSION_SECRET: 'isolated-order-payment-status-secret-32', NODE_ENV: 'test' };
const store = new Store(env); store.set('market', 'gold', { pricePerGram: 24000000, isManualOverride: true }); createApp(store, env);
const auth = createAuthStore(store, env);
const token = auth.createSessionToken([...store.map('users').values()].find(user => user.role === 'admin'));
async function request(path, method = 'GET', body) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, data: await response.json() };
}
const accounting = () => createAccounting(store).snapshot();
let actions = 0;
const mutation = (action, body) => request(`/api/admin/accounting/${action}`, 'POST', { actionId: `order-payment-status-${++actions}`, expectedRevision: accounting().revision, ...body });
const product = (await request('/api/admin/products', 'POST', { title: 'مروارید آزمون پرداخت', pricingMode: 'fixed', fixedPrice: 5000000, stock: 10, images: ['/fixture.webp'] })).data;
const now = new Date().toISOString();
async function placeOrder(id) {
  // Same state checkout leaves: stock deducted and held for review.
  store.set('products', product.id, { ...store.get('products', product.id), stock: store.get('products', product.id).stock - 1 });
  store.set('orders', id, { id, trackingCode: id.toUpperCase(), userId: 'payment-customer', customerName: 'مشتری', customerPhone: '09121111111', customerAddress: 'نشانی آزمایشی کامل',
    contactMethod: 'phone', status: 'در انتظار بررسی', paymentMethod: 'card_to_card', paymentTrackingNumber: `TRK-${id}`, paymentDate: now, createdAt: now, inventoryReleased: false,
    totalWeight: 0, totalPrice: 5000000, items: [{ productId: product.id, productTitle: product.title, productImage: '', weight: 0, quantity: 1, unitPrice: 5000000, totalPrice: 5000000, goldPriceAtOrder: 0, makingChargePercent: 0 }] });
  await request('/api/admin/accounting/sync-site', 'POST');
  assert.equal((await request(`/api/orders/${id}/status`, 'PATCH', { status: 'تأیید شده' })).status, 200);
  assert.equal(accounting().totals[id].paid, 5000000, 'Approval records the verified payment');
}
const active = id => accounting().money.filter(entry => entry.saleId === id && !entry.voidedAt);

// 1. Rejecting after approval (e.g. a forged receipt) voids the automatic receipt, with history.
await placeOrder('rejected-after-approval');
const stockBefore = store.get('products', product.id).stock;
assert.equal((await request('/api/orders/rejected-after-approval/status', 'PATCH', { status: 'رد شده' })).status, 200);
let data = accounting();
assert.equal(data.totals['rejected-after-approval'].paid, 0);
assert.equal(active('rejected-after-approval').length, 0);
assert.ok(data.money.some(entry => entry.saleId === 'rejected-after-approval' && entry.voidedAt), 'Voided receipt stays in history');
assert.ok(data.audit.some(entry => entry.target === 'rejected-after-approval' && entry.action === 'ابطال خودکار دریافت با رد سفارش'));
assert.equal(data.report.cashMovement, 0, 'Rejected payment no longer counts as cash');
assert.equal(store.get('products', product.id).stock, stockBefore + 1, 'Stock is still restored once');

// Re-approving after a mistaken rejection records the payment again, exactly once.
assert.equal((await request('/api/orders/rejected-after-approval/status', 'PATCH', { status: 'تأیید شده' })).status, 200);
await request('/api/admin/accounting/sync-site', 'POST'); await request('/api/admin/accounting/sync-site', 'POST');
assert.equal(active('rejected-after-approval').length, 1);
assert.equal(accounting().totals['rejected-after-approval'].paid, 5000000);

// An admin's own void is never reversed by re-approval.
const entry = active('rejected-after-approval')[0];
assert.equal((await mutation('money-void', { entryId: entry.id, reason: 'ثبت اشتباه آزمایشی' })).status, 200);
await request('/api/admin/accounting/sync-site', 'POST');
assert.equal(active('rejected-after-approval').length, 0);

// 2. Cancelling a paid order is refused until the refund is recorded.
await placeOrder('cancelled-after-payment');
let response = await request('/api/orders/cancelled-after-payment/status', 'PATCH', { status: 'لغو شده' });
assert.equal(response.status, 409);
assert.match(response.data.error, /بازپرداخت/);
assert.equal(store.get('orders', 'cancelled-after-payment').status, 'تأیید شده', 'Refused cancel leaves the order unchanged');
assert.equal(active('cancelled-after-payment').length, 1, 'Real payment is not voided by a cancel');
assert.equal((await mutation('return', { saleId: 'cancelled-after-payment', amount: 5000000, shippingRefund: 0, restock: true, items: [], reference: 'REFUND-1', note: 'بازپرداخت پیش از تحویل', date: accountingDay() })).status, 200);
assert.equal((await request('/api/orders/cancelled-after-payment/status', 'PATCH', { status: 'لغو شده' })).status, 200);
data = accounting();
assert.equal(data.totals['cancelled-after-payment'].paid, 5000000);
assert.equal(data.totals['cancelled-after-payment'].refunded, 5000000);

// A manually recorded receipt also blocks rejection until it is refunded or voided.
await placeOrder('manual-receipt');
const automatic = active('manual-receipt')[0];
assert.equal((await mutation('money-void', { entryId: automatic.id, reason: 'جایگزینی با دریافت دستی' })).status, 200);
assert.equal((await mutation('money', { kind: 'receipt', method: 'card_to_card', saleId: 'manual-receipt', amount: 5000000, fee: 0, reference: 'MANUAL-1', note: 'دریافت دستی', date: accountingDay() })).status, 200);
response = await request('/api/orders/manual-receipt/status', 'PATCH', { status: 'رد شده' });
assert.equal(response.status, 409);
assert.equal(active('manual-receipt').length, 1, 'Manual receipts are never voided automatically');

// Unpaid pending orders are rejected exactly as before.
store.set('orders', 'unpaid-pending', { ...store.get('orders', 'manual-receipt'), id: 'unpaid-pending', trackingCode: 'UNPAID', status: 'در انتظار بررسی' });
await request('/api/admin/accounting/sync-site', 'POST');
assert.equal((await request('/api/orders/unpaid-pending/status', 'PATCH', { status: 'رد شده' })).status, 200);

// 3. Completing a sale from accounting notifies the customer once, like the orders panel.
await placeOrder('completed-in-accounting');
const notices = () => [...store.map('notifications').values()].filter(n => n.orderId === 'completed-in-accounting' && n.status === 'تکمیل شده').length;
const completeBody = { actionId: 'order-payment-status-complete', expectedRevision: accounting().revision, saleId: 'completed-in-accounting', date: accountingDay() };
assert.equal((await request('/api/admin/accounting/complete', 'POST', completeBody)).status, 200);
assert.equal(store.get('orders', 'completed-in-accounting').status, 'تکمیل شده');
assert.equal(notices(), 1);
assert.equal((await request('/api/admin/accounting/complete', 'POST', completeBody)).status, 200, 'Replay is accepted');
assert.equal(notices(), 1, 'Replay sends no second notification');

console.log('PASS: rejection voids automatic receipts (re-approval restores them), paid orders need a refund before cancel/reject, and accounting completion notifies the customer once.');
