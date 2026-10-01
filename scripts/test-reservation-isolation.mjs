import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
const env = { SESSION_SECRET: 'reservation-isolation-test-secret-more-than-32', NODE_ENV: 'test' };
const store = new Store(env);
store.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
createApp(store, env);
const auth = createAuthStore(store, env);
function buyer(phone) {
  store.set('otp', phone, { code: '12345', attempts: 0, expiresAt: Date.now() + 180000 });
  return auth.verifySmsOtpAndAuthenticate(phone, '12345');
}
const one = buyer('09120000701'), two = buyer('09120000702');
const product = store.get('products', 'pearl-p9'); product.stock = 3;
const items = [{ productId: product.id, quantity: 1 }];
async function request(path, body, token = one.token) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
}
for (const path of ['/api/cart/reserve', '/api/cart/reserve-batch', '/api/cart/release-reservation']) assert.equal((await request(path, { items, ...items[0] }, null)).status, 401);
assert.equal(store.map('reservations').size, 0);
const first = await request('/api/orders/quote', { items });
const second = await request('/api/orders/quote', { items });
assert.equal(first.status, 200); assert.equal(second.status, 200);
assert.notEqual(first.body.quoteId, second.body.quoteId);
assert.equal(store.get('reservations', product.id).length, 2);
await request('/api/cart/release-reservation', { productId: product.id });
assert.equal(store.get('reservations', product.id).length, 2, 'draft release must not affect either quote');
const payload = { items, customerName: 'مشتری تست', customerPhone: '09120000701', customerAddress: 'تهران خیابان آزمایشی پلاک یک', paymentReceiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABKUlEQVR4nO3RMQEAAAyDsPk33cnIQwxwcAt1Np8GYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1oBZD5TpSzIEvJyiAAAAAElFTkSuQmCC' };
assert.equal((await request('/api/orders', { ...payload, quoteId: first.body.quoteId })).status, 201);
assert.deepEqual(store.get('reservations', product.id).map(r => r.reservationId), [second.body.quoteId]);
assert.equal((await request('/api/cart/reserve', { ...items[0] }, two.token)).status, 200);
const completed = await request('/api/orders', { ...payload, quoteId: second.body.quoteId });
assert.equal(completed.status, 201, JSON.stringify(completed.body));
assert.equal(completed.body.order.paymentReviewRequired, false);
assert.equal(store.get('products', product.id).stock, 1);
assert.equal(store.get('reservations', product.id).length, 1);
assert.equal(store.get('reservations', product.id)[0].userId, `usr_${two.user.uid}`);
console.log('PASS: separate quote reservations survive another checkout, competitor draft and draft release; all reservation routes reject anonymous requests.');
