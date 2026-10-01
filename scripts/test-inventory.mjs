import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';

const env = { SESSION_SECRET: 'isolated-inventory-test-secret-longer-than-32', NODE_ENV: 'test' };
const store = new Store(env);
store.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
let app = createApp(store, env);
const auth = createAuthStore(store, env);
const token = auth.createSessionToken([...store.map('users').values()].find(user => user.role === 'admin'));
async function request(path, method = 'GET', body) {
  const response = await app.fetch(new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
}
const product = [...store.map('products').values()].find(product => product.stock > 0);
async function setStock(stock) {
  const result = await request(`/api/admin/products/${product.id}`, 'PUT', { stock, availableStock: 0 });
  assert.equal(result.status, 200);
  assert.equal(result.body.availableStock, stock);
  assert.equal(store.get('products', product.id).availableStock, undefined);
}
async function available() { return (await request(`/api/products/${product.id}`)).body.availableStock; }
await setStock(3);
const created = await request('/api/orders', 'POST', {
  customerName: 'مشتری تست', customerPhone: '09120000001', customerAddress: 'تهران خیابان آزمایشی پلاک یک',
  items: [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 1 }],
  paymentReceiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABKUlEQVR4nO3RMQEAAAyDsPk33cnIQwxwcAt1Np8GYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1oBZD5TpSzIEvJyiAAAAAElFTkSuQmCC',
});
assert.equal(created.status, 201);
const orderId = created.body.order.id;
assert.equal(await available(), 1);
async function update(body, expected = 200) {
  const result = await request(`/api/orders/${orderId}/status`, 'PATCH', body);
  assert.equal(result.status, expected, JSON.stringify(result.body));
  return result;
}
await update({ status: 'لغو شده' });
assert.equal(await available(), 3);
await update({ status: 'لغو شده' });
await update({ rejectionReason: 'توضیح جدید' });
assert.equal(await available(), 3);
assert.equal(store.get('orders', orderId).inventoryReleased, true);
await update({ status: 'تأیید شده' });
assert.equal(await available(), 1);
await update({ status: 'رد شده' });
assert.equal(await available(), 3);
await setStock(1);
await update({ status: 'تأیید شده' }, 409);
assert.equal(await available(), 1);
assert.equal(store.get('orders', orderId).status, 'رد شده');
await setStock(4);
app = createApp(store, env);
assert.equal(await available(), 4);
await setStock(0);
assert.equal(await available(), 0);
console.log('PASS: manual restock, zero stock, cancellation/rejection restoration exactly once, metadata-only edit, safe reactivation and persistence across app reload. In-memory data only.');
