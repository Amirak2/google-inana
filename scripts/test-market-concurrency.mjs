import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';

// Actual handlers/storage pipeline, isolated PG protocol fixture, no real services.
process.env.PG_URI = 'postgresql://unused/market-concurrency';
const db = installFakePostgres();
const originalFetch = globalThis.fetch, originalNow = Date.now;
const hour = 3600000;
let clock = Math.floor(originalNow() / hour) * hour + hour / 2;
Date.now = () => clock++;
globalThis.fetch = async () => { throw new Error('External requests forbidden in concurrency regression'); };
const env = { SESSION_SECRET: 'isolated-market-concurrency-test-secret-at-least-32', NODE_ENV: 'test' };
const deps = { externalize: async () => new Map(), migrate: async () => {} };
function request(path, method = 'GET', body, token, ip = '198.51.100.1') {
  const req = new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return runPostgresRequest(method, path, env, (store, requestEnv) => createApp(store, requestEnv).fetch(req.clone(), { clientIp: ip }), deps);
}
const allSuccessful = results => {
  assert.equal(results.filter(r => r.status === 'rejected').length, 0, 'No request may exhaust storage retries');
  assert.ok(results.every(r => r.value.status === 200));
};
try {
  const seed = await PostgresStore.load(true);
  seed.set('market', 'gold', { pricePerGram: 23932462, dailyHigh: 23932462, dailyLow: 23932462, isManualOverride: true });
  createApp(seed, env);
  const auth = createAuthStore(seed, env);
  const adminToken = auth.createSessionToken([...seed.map('users').values()].find(user => user.role === 'admin'));
  const users = Array.from({ length: 20 }, (_, i) => ({ uid: `load-user-${i}`, email: `load${i}@example.test`, displayName: 'مشتری آزمایشی', phoneNumber: `0912000${String(i).padStart(4, '0')}`, role: 'customer', phoneVerified: true, createdAt: new Date().toISOString() }));
  for (const user of users) seed.set('users', user.email, user);
  const tokens = users.map(user => auth.createSessionToken(user));
  await seed.commit(); await seed.release();

  assert.equal((await request('/api/products')).status, 200);
  const firstHistory = db.get('market', 'hourlyHistory');
  const before = db.events.length;
  allSuccessful(await Promise.allSettled(Array.from({ length: 30 }, (_, i) => request(i % 2 ? '/api/products' : '/api/gold-price'))));
  assert.deepEqual(db.get('market', 'hourlyHistory'), firstHistory, 'Same-hour/same-price reads retain the original timestamp');
  assert.equal(db.events.slice(before).filter(sql => sql.startsWith('INSERT INTO site_records')).length, 0, 'Warm public reads must not write records');

  clock += hour;
  allSuccessful(await Promise.allSettled(Array.from({ length: 20 }, () => request('/api/products'))));
  const nextHistory = db.get('market', 'hourlyHistory');
  assert.equal(nextHistory.length, 2, 'The new hour must still be recorded once');
  assert.equal(new Set(nextHistory.map(point => Math.floor(point.timestamp / hour))).size, 2);
  const changed = await request('/api/admin/gold-price', 'POST', { pricePerGram: 25000000, isManualOverride: true }, adminToken);
  assert.equal(changed.status, 200);
  const changedHistory = db.get('market', 'hourlyHistory');
  assert.equal(changedHistory.length, 2);
  assert.equal(changedHistory.at(-1).price, 25000000, 'Changing the actual price updates this hour immediately');
  allSuccessful(await Promise.allSettled(Array.from({ length: 20 }, () => request('/api/products'))));
  assert.deepEqual(db.get('market', 'hourlyHistory'), changedHistory);

  const pearl = db.get('products', 'pearl-p3');
  pearl.stock = 1; db.set('products', pearl.id, pearl);
  const receipt = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAACXBIWXMAAAPoAAAD6AG1e1JrAAABKUlEQVR4nO3RMQEAAAyDsPk33cnIQwxwcAt1Np8GYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1gCsAVgDsAZgDcAagDUAawDWAKwBWAOwBmANwBqANQBrANYArAFYA7AGYA3AGoA1AGsA1oBZD5TpSzIEvJyiAAAAAElFTkSuQmCC';
  const checkout = (user, i, productId) => request('/api/orders', 'POST', {
    customerName: user.displayName, customerPhone: user.phoneNumber, customerAddress: 'تهران خیابان آزمایشی پلاک یک',
    items: [{ productId, quantity: 1 }], paymentReceiptImage: receipt, idempotencyKey: `load-${productId}-${i}`,
  }, tokens[i], `198.51.100.${i + 1}`);
  const attempts = await Promise.allSettled(users.map((user, i) => checkout(user, i, pearl.id)));
  assert.equal(attempts.filter(r => r.status === 'rejected').length, 0, 'Stock losers get a normal response rather than exhausting retries');
  assert.equal(attempts.filter(r => r.value.status === 201).length, 1);
  assert.equal(attempts.filter(r => r.value.status === 409).length, 19);
  assert.equal(db.get('products', pearl.id).stock, 0);

  // Independent purchases must also finish; only real inventory competition conflicts.
  users.forEach((_, i) => db.set('products', `load-product-${i}`, { ...pearl, id: `load-product-${i}`, stock: 1 }));
  const independent = await Promise.allSettled(users.map((user, i) => checkout(user, i, `load-product-${i}`)));
  assert.equal(independent.filter(r => r.status === 'rejected').length, 0);
  assert.ok(independent.every(r => r.value.status === 201));
  const inspect = await PostgresStore.load(false);
  assert.equal(inspect.map('orders').size, 21);
  await inspect.release();
  assert.equal(db.activeClients, 0);
  assert.equal(db.activeTransactions, 0);
  console.log('PASS: 30 concurrent warm reads write nothing; 20 hour-boundary reads succeed; changed prices persist; 20 last-item buyers yield one sale and 19 stock responses; 20 independent orders succeed; no connection/transaction leaks. Simulated PG only.');
} finally { Date.now = originalNow; globalThis.fetch = originalFetch; db.restore(); }
