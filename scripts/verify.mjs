import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
const env = { SESSION_SECRET: 'full-flow-test-secret-longer-than-32-characters', NODE_ENV: 'test' };
const store = new Store(env);
store.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
let cookie = '';
async function request(path, method = 'GET', body) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const setCookie = response.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
  return { status: response.status, body: await response.json() };
}
const products = await request('/api/products'); assert.equal(products.status, 200);
const mobile = '09120000812';
store.set('otp', mobile, { code: '12345', attempts: 0, expiresAt: Date.now() + 180000 });
const login = await request('/api/auth/otp/verify', 'POST', { mobile, code: '12345' });
assert.equal(login.status, 200); assert.ok(cookie);
// A fresh app authenticates and updates the profile using only the server cookie.
assert.equal((await request('/api/auth/me')).body.user.uid, login.body.user.uid);
const profile = await request('/api/auth/profile', 'PUT', { displayName: 'مشتری تست', address: 'تهران خیابان آزمایشی پلاک یک' });
assert.equal(profile.status, 200); assert.equal(profile.body.user.displayName, 'مشتری تست');
const items = [{ productId: products.body.find(p => p.stock > 0).id, quantity: 1 }];
assert.equal((await request('/api/cart/reserve-batch', 'POST', { items })).status, 200);
const quote = await request('/api/orders/quote', 'POST', { items }); assert.equal(quote.status, 200);
const body = { items, quoteId: quote.body.quoteId, idempotencyKey: 'full-flow', customerName: 'مشتری تست', customerPhone: mobile, customerAddress: 'تهران خیابان آزمایشی پلاک یک', paymentReceiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=' };
const order = await request('/api/orders', 'POST', body); assert.equal(order.status, 201);
assert.equal((await request('/api/orders', 'POST', body)).body.order.id, order.body.order.id);
assert.ok((await request('/api/orders')).body.some(row => row.id === order.body.order.id));
assert.equal((await request('/api/auth/logout', 'POST', {})).status, 200);
assert.equal((await request('/api/auth/me')).status, 401);
console.log('PASS: current cookie/SMS storefront-to-quote-to-receipt checkout, restored profile editing, order listing, idempotency and logout. Isolated local store only.');
