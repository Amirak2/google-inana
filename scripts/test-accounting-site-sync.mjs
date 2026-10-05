import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createAccounting } from '../server/accounting.ts';
import { emptyCosts, accountingDay } from '../src/utils/accounting.ts';

const env = { SESSION_SECRET: 'isolated-site-accounting-sync-secret-32', NODE_ENV: 'test' };
const store = new Store(env); store.set('market', 'gold', { pricePerGram: 24000000, isManualOverride: true }); createApp(store, env);
const auth = createAuthStore(store, env);
const token = auth.createSessionToken([...store.map('users').values()].find(user => user.role === 'admin'));
const customer = { uid: 'sync-customer', role: 'customer', phoneNumber: '09121111111', email: 'sync@example.test', displayName: 'مشتری', createdAt: new Date().toISOString() };
store.set('users', customer.email, customer); const customerToken = auth.createSessionToken(customer);
async function request(path, method = 'GET', body, access = token) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, data: await response.json() };
}
const accounting = () => createAccounting(store);
assert.equal((await request('/api/admin/accounting/sync-site', 'POST', undefined, null)).status, 401);
assert.equal((await request('/api/admin/accounting/sync-site', 'POST', undefined, customerToken)).status, 403);
const initialCatalog = accounting().snapshot().catalog;
assert.equal(initialCatalog.length, store.map('products').size, 'Every current product is visible without creating fictitious purchase entries');
const created = await request('/api/admin/products', 'POST', { title: 'مروارید جدید آزمایشی', pricingMode: 'fixed', fixedPrice: 500, stock: 3, images: ['/local-fixture.webp'] });
assert.equal(created.status, 201); const product = created.data;
let row = accounting().snapshot().catalog.find(row => row.id === product.id);
assert.equal(row.stock, 3); assert.equal(row.unknownQuantity, 3); assert.equal(row.inventoryCost, 0);
assert.equal(accounting().snapshot().purchases.length, 0, 'Catalog inclusion never invents acquisition prices');
assert.equal((await request(`/api/admin/products/${product.id}`, 'PUT', { title: 'نام تازهٔ محصول', stock: 4, expectedStock: 3 })).status, 200);
row = accounting().snapshot().catalog.find(row => row.id === product.id); assert.equal(row.stock, 4); assert.equal(row.title, 'نام تازهٔ محصول');

const now = new Date().toISOString();
const order = { id: 'real-site-fixture', trackingCode: 'SITE-ONE', customerName: 'مشتری سایت', customerPhone: '09121111111', customerAddress: 'نشانی آزمایشی', contactMethod: 'phone',
  status: 'در انتظار بررسی', paymentMethod: 'online', paymentTrackingNumber: 'BANK-FIXTURE', paymentDate: now, createdAt: now, inventoryReleased: false,
  totalWeight: 0, totalPrice: 500, items: [{ productId: product.id, productTitle: product.title, productImage: '', weight: 0, quantity: 1, unitPrice: 500, totalPrice: 500, goldPriceAtOrder: 0, makingChargePercent: 0 }] };
store.set('orders', order.id, order); store.set('products', product.id, { ...store.get('products', product.id), stock: 3 });
assert.equal((await request('/api/admin/accounting/sync-site', 'POST')).status, 200);
let data = accounting().snapshot(); assert.ok(data.sales.find(sale => sale.id === order.id)); assert.equal(data.money.length, 0, 'Customer receipt upload or online-method claim alone is not a verified payment');
assert.equal(data.catalog.find(row => row.id === product.id).held, 1);
assert.equal(data.report.siteOrderCount, 1);
const revision = data.revision;
await request('/api/admin/accounting/sync-site', 'POST'); assert.equal(accounting().snapshot().revision, revision, 'No-op automatic sync preserves edit revision');
assert.equal((await request(`/api/orders/${order.id}/status`, 'PATCH', { status: 'تأیید شده' })).status, 200);
data = accounting().snapshot(); assert.equal(data.money.length, 1); assert.equal(data.money[0].source, 'site'); assert.equal(data.money[0].method, 'pasargad');
assert.equal(data.totals[order.id].paid, 500); assert.equal(data.totals[order.id].pendingSettlement, 500);
await request('/api/admin/accounting/sync-site', 'POST'); await request('/api/admin/accounting/sync-site', 'POST');
assert.equal(accounting().snapshot().money.length, 1, 'Repeated server requests never duplicate verified payment');
let count = 0;
const mutation = (action, body) => request(`/api/admin/accounting/${action}`, 'POST', { actionId: `site-sync-test-${++count}`, expectedRevision: accounting().snapshot().revision, ...body });
assert.equal((await mutation('purchase', { kind: 'opening', productId: product.id, quantity: 4, costs: { ...emptyCosts(), pearl: 300 }, date: accountingDay() })).status, 200);
assert.equal(store.get('products', product.id).stock, 3, 'Registering initial cost does not duplicate stock');
assert.equal((await request(`/api/orders/${order.id}/status`, 'PATCH', { status: 'تکمیل شده' })).status, 200);
data = accounting().snapshot(); assert.equal(data.totals[order.id].profit, 200); assert.equal(data.report.siteSoldQuantity, 1); assert.equal(data.report.channels.find(row => row.channel === 'site').revenue, 500);
assert.equal((await mutation('purchase', { kind: 'purchase', productId: product.id, quantity: 2, costs: { ...emptyCosts(), pearl: 350 }, date: accountingDay() })).status, 200);
data = accounting().snapshot(); assert.equal(data.catalog.find(row => row.id === product.id).stock, 5); assert.equal(data.report.purchaseQuantity, 2); assert.equal(data.report.purchaseAmount, 700); assert.equal(data.totals[order.id].cost, 300);

// Existing confirmed site orders import without a button, but reviewed Instagram sales remain manual.
const legacy = { ...order, id: 'legacy-site-fixture', trackingCode: 'SITE-TWO', status: 'تأیید شده', paymentMethod: 'card_to_card', paymentTrackingNumber: 'CARD-FIXTURE', reviewedAt: now };
store.set('orders', legacy.id, legacy);
const ig = { ...legacy, id: 'instagram-old-fixture', trackingCode: 'IG-OLD' }; store.set('orders', ig.id, ig);
await request('/api/admin/accounting/sync-site', 'POST'); data = accounting().snapshot();
assert.equal(data.totals[legacy.id].paid, 500); assert.equal(data.totals[ig.id].paid, 0);
assert.equal((await mutation('money-void', { entryId: data.money.find(entry => entry.saleId === legacy.id).id, reason: 'تأیید اشتباه فیش' })).status, 200);
await request('/api/admin/accounting/sync-site', 'POST'); assert.equal(accounting().snapshot().totals[legacy.id].paid, 0, 'Auto sync does not recreate a voided mistaken payment');
const manuallyPaid = { ...order, status: 'در انتظار بررسی', id: 'site-previous-manual-payment', trackingCode: 'SITE-MANUAL' }; store.set('orders', manuallyPaid.id, manuallyPaid);
await request('/api/admin/accounting/sync-site', 'POST');
const manualReceipt = await mutation('money', { saleId: manuallyPaid.id, kind: 'receipt', method: 'card_to_card', amount: 500, fee: 0, reference: 'MANUAL-OLD-PAY', note: 'ثبت دستی قبلی', date: accountingDay() });
assert.equal(manualReceipt.status, 200);
store.set('orders', manuallyPaid.id, { ...manuallyPaid, status: 'تأیید شده' }); await request('/api/admin/accounting/sync-site', 'POST');
assert.equal(accounting().snapshot().money.filter(entry => entry.saleId === manuallyPaid.id).length, 1, 'Already recorded full manual payment is not counted twice');
assert.equal((await mutation('money-void', { entryId: manualReceipt.data.result.id, reason: 'اصلاح دریافت قبلی' })).status, 200);
await request('/api/admin/accounting/sync-site', 'POST'); assert.equal(accounting().snapshot().totals[manuallyPaid.id].paid, 0, 'Auto sync also respects a voided manual receipt');
assert.equal((await request(`/api/admin/products/${product.id}`, 'DELETE')).status, 200);
data = accounting().snapshot(); assert.ok(!data.catalog.find(row => row.id === product.id)); assert.equal(data.totals[order.id].cost, 300, 'Product deletion preserves historical costs');
console.log('PASS: existing and future site catalog, shared stock, automatic order import, trusted admin payment verification, no duplicate or recreated receipts, site sales/purchase statistics and private access.');
