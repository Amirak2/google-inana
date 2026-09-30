import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { validateReceipt } from '../server/receiptValidation.ts';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=';
const rejected = [undefined, null, '', '   ', 123, {}, 'https://example.com/receipt.jpg', '/api/receipts/another-user', 'data:image/png;base64,aGVsbG8=', 'data:image/png;base64,' + 'A'.repeat(800000)];
for (const value of rejected) assert.ok(validateReceipt(value));
assert.equal(validateReceipt(png), null);

const env = { SESSION_SECRET: 'isolated-test-secret-longer-than-32-characters', NODE_ENV: 'test' };
const store = new Store(env);
store.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
const app = createApp(store, env);
const auth = createAuthStore(store, env);
const user = [...store.map('users').values()].find(user => user.role === 'admin');
const token = auth.createSessionToken(user);
const product = [...store.map('products').values()].find(product => product.stock > 0);
assert.ok(product);
const stockBefore = product.stock;
const payload = { customerName: 'مشتری تست', customerPhone: '09120000001', customerAddress: 'تهران خیابان آزمایشی پلاک یک', items: [{ productId: product.id, quantity: 1 }], paymentMethod: 'card_to_card' };
for (const paymentReceiptImage of rejected.slice(0, 9)) {
  const response = await app.fetch(new Request('http://localhost/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...payload, paymentReceiptImage }) }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /فیش/);
  assert.equal(store.map('orders').size, 0);
  assert.equal(store.get('products', product.id).stock, stockBefore);
}
const success = await app.fetch(new Request('http://localhost/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...payload, paymentReceiptImage: png }) }));
assert.equal(success.status, 201, await success.clone().text());
assert.equal(store.map('orders').size, 1);
assert.equal(store.get('products', product.id).stock, stockBefore - 1);
console.log('PASS: orders reject missing/invalid receipts without changing stock; uploaded receipt permits checkout. All data stayed in memory.');
