import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { PEARL_GOLD_PRODUCTS, INITIAL_COLLECTIONS } from '../src/data/seedData.ts';
import { calculateProductPrice, DEFAULT_SETTINGS } from '../src/utils/pricingEngine.ts';
import { changedProductFields } from '../src/utils/adminProductForm.ts';

const product = PEARL_GOLD_PRODUCTS[0];
assert.equal(product.sku, 'a7');
assert.equal(product.weight, 0.840);
assert.equal(product.stock, 1);
assert.ok(INITIAL_COLLECTIONS.some(c => c.name === product.collection && c.coverImage === product.images[0]));
for (const rate of [15_000_000, 25_863_228, 30_000_000]) {
  const price = calculateProductPrice(product, rate, DEFAULT_SETTINGS);
  const gold = rate * 0.840;
  assert.equal(price.pearlCost, 2_000_000);
  assert.equal(price.makingChargeAmount, Math.round(gold * 0.165));
  assert.equal(price.profitAmount, Math.round(gold * 1.165 * 0.07));
  assert.equal(price.taxAmount, 0);
  assert.equal(price.finalPrice, Math.round((2_000_000 + gold * 1.165 * 1.07) / 1000) * 1000);
  const withoutPearls = calculateProductPrice({ ...product, pearlPrice: 0 }, rate, DEFAULT_SETTINGS);
  assert.equal(price.finalPrice - withoutPearls.finalPrice, 2_000_000);
  assert.equal(price.makingChargeAmount, withoutPearls.makingChargeAmount);
  assert.equal(price.profitAmount, withoutPearls.profitAmount);
}
const env = { SESSION_SECRET: 'isolated-pearl-gold-test-secret-over-32', NODE_ENV: 'test', SERVIX_API_KEY: 'test-cache-only' };
const store = new Store(env);
store.set('market', 'gold', { pricePerGram: 25_863_228, isManualOverride: false });
store.set('market', 'fetchedAt', Date.now());
createApp(store, env);
const admin = [...store.map('users').values()].find(user => user.role === 'admin');
const token = createAuthStore(store, env).createSessionToken(admin);
async function request(path, method = 'GET', body) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: response.status, body: await response.json() };
}
const quote = await request('/api/orders/quote', 'POST', { items: [{ productId: product.id, quantity: 1 }] });
assert.equal(quote.status, 200);
assert.equal(quote.body.totalPrice, calculateProductPrice(product, 25_863_228, DEFAULT_SETTINGS).finalPrice);
assert.equal(quote.body.totalWeight, 0.840);
assert.equal((await request(`/api/admin/products/${product.id}`, 'PUT', { title: product.title + ' جدید' })).status, 200);
assert.equal(store.get('products', product.id).pearlPrice, 2_000_000, 'Metadata edits preserve the pearl component');
for (const bad of [-1, 1.5, 'invalid', 1_000_000_001]) {
  assert.equal((await request(`/api/admin/products/${product.id}`, 'PUT', { pearlPrice: bad })).status, 400);
  assert.equal((await request('/api/admin/products', 'POST', { title: 'محصول آزمایشی', weight: 0.840, pearlPrice: bad })).status, 400);
}
assert.deepEqual(changedProductFields(product, { ...product, pearlPrice: 2_100_000 }), { pearlPrice: 2_100_000 });
assert.equal((await request(`/api/admin/products/${product.id}`, 'PUT', { pearlPrice: 2_100_000 })).status, 200);
store.get('products', product.id).stock = 0;
createApp(store, env);
assert.equal(store.get('products', product.id).stock, 0, 'Restart must not replenish sold inventory');
assert.equal(store.get('products', product.id).pearlPrice, 2_100_000, 'Restart must not overwrite administrator changes');
console.log('PASS: hybrid pricing, quote totals, pearl fee exclusion, input validation, editing and non-restocking migration.');
