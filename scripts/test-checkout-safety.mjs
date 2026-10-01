import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { boundedLogDetails } from '../server/checkoutSafety.ts';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';

const env = { SESSION_SECRET: 'checkout-safety-test-secret-longer-than-32', NODE_ENV: 'test' };
const store = new Store(env);
store.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
let app = createApp(store, env);
const auth = createAuthStore(store, env);
const admin = [...store.map('users').values()].find(u => u.role === 'admin');
const token = auth.createSessionToken(admin);
store.set('otp', '09120000999', { code: '12345', attempts: 0, expiresAt: Date.now() + 180000 });
const competitorToken = auth.verifySmsOtpAndAuthenticate('09120000999', '12345').token;
const products = [...store.map('products').values()].filter(p => p.stock > 0);
const [a, b] = products;
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
async function request(path, body, method = 'POST', authenticated = true) {
  app = createApp(store, env);
  const response = await app.fetch(new Request(`http://localhost${path}`, { method, headers: authenticated ? headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { clientIp: '198.51.100.10' });
  return { status: response.status, body: await response.json() };
}
const items = [{ productId: a.id, quantity: 1 }];
assert.equal((await request('/api/orders/quote', { items }, 'POST', false)).status, 401);
assert.equal((await request('/api/orders/quote', { items: Array(51).fill(items[0]) })).status, 400);
assert.equal((await request('/api/orders/quote', { items: [{ productId: a.id, quantity: 11 }, { productId: a.id, quantity: 10 }] })).status, 400);
assert.equal(store.map('quotes').size, 0);

// A failed second item leaves no reservation on the first.
b.stock = 0;
assert.equal((await request('/api/cart/reserve-batch', { items: [...items, { productId: b.id, quantity: 1 }] })).status, 409);
assert.equal(store.map('reservations').size, 0);
a.stock = 1;
assert.equal((await request('/api/cart/reserve-batch', { items })).status, 200);
const oldReservation = store.get('reservations', a.id)[0];
oldReservation.expiresAt = Date.now() + 1000;
const quote = await request('/api/orders/quote', { items });
assert.equal(quote.status, 200);
assert.ok(store.get('reservations', a.id)[0].expiresAt >= quote.body.expiresAt);
const realNow = Date.now;
const issuedAt = realNow();
try {
  Date.now = () => issuedAt + 11 * 60000;
  const competitor = await app.fetch(new Request('http://localhost/api/cart/reserve', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${competitorToken}` },
    body: JSON.stringify({ productId: a.id, quantity: 1 }),
  }), { clientIp: '198.51.100.20' });
  assert.equal(competitor.status, 409, 'at minute eleven the paid quote still owns the last item');
} finally { Date.now = realNow; }

// Expiration and a changed market must keep the paid quote's original amount.
const q = store.get('quotes', quote.body.quoteId);
q.expiresAt = Date.now() - 1;
store.get('reservations', a.id)[0].expiresAt = Date.now() - 1;
const originalPrice = q.totalPrice;
store.set('market', 'gold', { pricePerGram: 30000000, isManualOverride: true });
a.stock = 0;
app = createApp(store, env);
const payload = { customerName: 'مشتری تست', customerPhone: '09120000001', customerAddress: 'تهران خیابان آزمایشی پلاک یک', items, quoteId: q.quoteId, idempotencyKey: 'test-paid-expiration', paymentReceiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=' };
const paid = await request('/api/orders', payload);
assert.equal(paid.status, 201, JSON.stringify(paid.body));
assert.equal(paid.body.order.totalPrice, originalPrice);
assert.equal(paid.body.order.paymentReviewRequired, true);
assert.equal(paid.body.order.inventoryReleased, true);
assert.equal(store.get('products', a.id).stock, 0);
assert.equal((await request('/api/orders', payload)).body.order.id, paid.body.order.id);
const orderPath = `/api/orders/${paid.body.order.id}/status`;
assert.equal((await request(orderPath, { status: 'تایید شده' }, 'PATCH')).status, 409);
assert.equal((await request(orderPath, { status: 'لغو شده' }, 'PATCH')).status, 200);
assert.equal(a.stock, 0, 'cancelling an unallocated paid claim must not add phantom stock');
store.get('products', a.id).stock = 1;
assert.equal((await request(orderPath, { status: 'تایید شده' }, 'PATCH')).status, 200);
assert.equal(store.get('products', a.id).stock, 0);

// Independent, idempotent favorite operations preserve unrelated products.
for (const productId of [a.id, b.id]) assert.equal((await request('/api/user/favorites', { productId, action: 'add' }, 'PATCH')).status, 200);
await request('/api/user/favorites', { productId: a.id, action: 'remove' }, 'PATCH');
await request('/api/user/favorites', { productId: a.id, action: 'remove' }, 'PATCH');
assert.deepEqual(store.get('favorites', admin.uid), [b.id]);

const longDetails = { text: 'x'.repeat(2100), nested: { values: Array(200).fill('z'.repeat(2000)) } };
assert.ok(JSON.stringify(boundedLogDetails(longDetails)).length <= 2000);
assert.equal((await request('/api/logs', { message: 'long detail test', details: longDetails })).status, 201);

// Three active quotes maximum, even if rate requests come from another IP.
store.map('quotes').clear(); store.map('rateLimits').clear(); store.get('products', a.id).stock = 4;
for (let i = 0; i < 3; i++) assert.equal((await request('/api/orders/quote', { items })).status, 200);
assert.equal((await request('/api/orders/quote', { items })).status, 429);
assert.equal(store.map('quotes').size, 3);
// A smaller new quote must not shorten an earlier quote's reserved quantity/deadline.
store.map('quotes').clear(); store.map('reservations').clear(); store.map('rateLimits').clear();
const large = await request('/api/orders/quote', { items: [{ productId: a.id, quantity: 3 }] });
await request('/api/orders/quote', { items });
assert.equal(store.get('reservations', a.id).reduce((total, r) => total + r.quantity, 0), 4);
assert.equal(new Set(store.get('reservations', a.id).map(r => r.reservationId)).size, 2);
assert.ok(store.get('reservations', a.id)[0].expiresAt >= large.body.expiresAt);

// Production snapshot pruning retains an expired quote for payment review.
process.env.PG_URI = 'postgresql://unused/test';
const db = installFakePostgres();
try {
  const pg = await PostgresStore.load(true);
  pg.set('quotes', 'expired-paid', { expiresAt: Date.now() - 1000, retainUntil: Date.now() + 86400000 });
  await pg.commit(); await pg.release();
  const next = await PostgresStore.load(false);
  assert.ok(next.get('quotes', 'expired-paid'));
  await next.release();
} finally { db.restore(); }
console.log('PASS: atomic reservation, quote deadline/limits/auth, original paid amount, stock-safe review/cancel/approval, idempotency, favorites, long logs, PostgreSQL quote retention. No live data touched.');
