import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore, PostgresConflictError } from '../server/postgresStorage.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';

process.env.PG_URI = 'postgresql://unused/test';
const db = installFakePostgres();
const originalFetch = globalThis.fetch;
const env = { SESSION_SECRET: 'isolated-postgres-request-secret-longer-than-32', NODE_ENV: 'test' };
const deps = { externalize: async () => new Map(), migrate: async () => {} };
let token;
const appRequest = (path, method = 'GET', body, ip = '198.51.100.7', overrides = {}) => {
  const request = new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return runPostgresRequest(method, path, { ...env, ...overrides }, (store, requestEnv) => createApp(store, requestEnv).fetch(request.clone(), { clientIp: ip }), deps);
};
function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
async function within(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Unrelated request blocked by external service')), 1500); })]); }
  finally { clearTimeout(timer); }
}
try {
  const seed = await PostgresStore.load(true);
  assert.equal(db.activeTransactions, 0);
  assert.equal(db.activeClients, 0);
  seed.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
  createApp(seed, env);
  token = createAuthStore(seed, env).createSessionToken([...seed.map('users').values()].find(user => user.role === 'admin'));
  await seed.commit(); await seed.release();
  db.set('test', 'key-order', { b: 2, a: { y: 2, x: 1 } });
  const same = await PostgresStore.load(true);
  same.set('test', 'key-order', { a: { x: 1, y: 2 }, b: 2 });
  const beforeNoop = db.events.length;
  await same.commit(); await same.release();
  assert.equal(db.events.length, beforeNoop, 'JSONB key order alone must not open a transaction');

  // GET/HEAD tracking persists across completely new app/store instances.
  for (let count = 1; count <= 30; count++) {
    const response = await appRequest('/api/orders/track/ABSENT01');
    assert.equal(response.status, 404);
    assert.equal(db.get('rateLimits', 'track_order_198.51.100.7').count, count);
  }
  assert.equal((await appRequest('/api/orders/track/ABSENT01')).status, 429);
  assert.equal((await appRequest('/api/orders/track/ABSENT01', 'GET', undefined, '198.51.100.8')).status, 404);

  // Two stale inventory snapshots cannot both commit the last item.
  db.set('testInventory', 'last-item', { stock: 1 });
  const ready = gate(); let arrivals = 0;
  const purchase = id => runPostgresRequest('POST', '/api/orders', env, async store => {
    const item = store.get('testInventory', 'last-item');
    if (item.stock < 1) return Response.json({ error: 'Sold out' }, { status: 409 });
    if (++arrivals === 2) ready.resolve();
    await ready.promise;
    item.stock--;
    store.set('testSales', id, { purchased: true });
    return Response.json({ purchased: true }, { status: 201 });
  }, { ...deps, load: (write, publicRead) => PostgresStore.load(write, publicRead) });
  const purchases = await Promise.all([purchase('one'), purchase('two')]);
  assert.deepEqual(purchases.map(response => response.status).sort(), [201, 409]);
  assert.equal(db.get('testInventory', 'last-item').stock, 0);
  assert.equal(Number(!!db.get('testSales', 'one')) + Number(!!db.get('testSales', 'two')), 1);

  // Exercise the actual checkout route, including receipt and stock validation.
  const pearl = db.get('products', 'pearl-p3');
  pearl.stock = 1; db.set('products', pearl.id, pearl);
  const checkout = {
    customerName: 'مشتری آزمایشی', customerPhone: '09120000003', customerAddress: 'تهران خیابان آزمایشی پلاک یک',
    items: [{ productId: pearl.id, quantity: 1 }],
    paymentReceiptImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9l8AAAAASUVORK5CYII=',
  };
  const checkouts = await Promise.all([appRequest('/api/orders', 'POST', checkout), appRequest('/api/orders', 'POST', checkout)]);
  assert.equal(checkouts.filter(response => response.status === 201).length, 1);
  assert.equal(checkouts.filter(response => response.status >= 400).length, 1);
  assert.equal(db.get('products', pearl.id).stock, 0);

  // Gold provider network and uploads have no active DB transaction/lease.
  for (const stage of ['price', 'upload']) {
    const started = gate(), resume = gate(); let providerCalls = 0;
    globalThis.fetch = async () => { providerCalls++; started.resolve(); await resume.promise; return Response.json({ price: 25000000 }); };
    let waited = false;
    const pending = runPostgresRequest('GET', '/api/products', env, async (store, requestEnv) => {
      if (stage === 'price') store.set('testMarket', stage, await (await requestEnv.marketFetch('https://provider.invalid/price')).json());
      return Response.json({ ok: true });
    }, { ...deps, externalize: async () => {
      if (stage === 'upload' && !waited) { waited = true; started.resolve(); await resume.promise; }
      return new Map();
    } });
    await started.promise;
    assert.equal(db.activeTransactions, 0, stage);
    assert.equal(db.activeClients, 0, stage);
    const other = await within(runPostgresRequest('POST', '/api/orders', env, async store => {
      store.set('testSales', stage, { ok: true }); return Response.json({ ok: true });
    }, deps));
    assert.equal(other.status, 200);
    resume.resolve(); assert.equal((await pending).status, 200);
    if (stage === 'price') assert.equal(providerCalls, 1, 'Stale retry must reuse price response');
  }

  // OTP is durable and locks released before delivery. A slow SMS cannot block orders.
  const smsStarted = gate(), smsResume = gate(); let smsCalls = 0;
  globalThis.fetch = async (_url, init) => {
    smsCalls++;
    const payload = JSON.parse(init.body);
    assert.equal(db.get('otp', payload.mobile).code, payload.code);
    assert.equal(db.activeTransactions, 0);
    assert.equal(db.activeClients, 0);
    smsStarted.resolve(); await smsResume.promise;
    return Response.json({ success: true, data: true });
  };
  const otp = appRequest('/api/auth/otp/send', 'POST', { mobile: '09120000001' }, '198.51.100.9', { SMS_OTP_API_KEY: 'test-only' });
  await smsStarted.promise;
  assert.equal((await within(appRequest('/api/orders/track/ABSENT01', 'GET', undefined, '198.51.100.10'))).status, 404);
  // Same-number concurrent request observes the committed cooldown, sends nothing.
  assert.equal((await appRequest('/api/auth/otp/send', 'POST', { mobile: '09120000001' }, '198.51.100.9', { SMS_OTP_API_KEY: 'test-only' })).status, 400);
  smsResume.resolve(); assert.equal((await otp).status, 200); assert.equal(smsCalls, 1);

  // Failed delivery removes only the matching undelivered code, retaining counters.
  globalThis.fetch = async () => Response.json({ success: false, data: false });
  await assert.rejects(appRequest('/api/auth/otp/send', 'POST', { mobile: '09120000002' }, '198.51.100.11', { SMS_OTP_API_KEY: 'test-only' }), /تأیید نکرد/);
  assert.equal(db.get('otp', '09120000002'), undefined);
  assert.equal(db.get('rateLimits', 'otp_phone_09120000002').count, 1);

  // Failed/abandoned transactions never leak pool clients or locks.
  for (const stage of ['BEGIN', 'pg_advisory_xact_lock', 'SELECT bucket', 'INSERT INTO', 'COMMIT']) {
    const store = await PostgresStore.load(true);
    store.set('cleanup', stage, true);
    const error = db.failNext(stage);
    await assert.rejects(store.commit(), value => value === error);
    await store.release(); await store.release();
    assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
  }
  assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
  console.log('PASS: durable tracking across reloads, isolated client IPs, stale snapshot retry/no oversell, slow gold/upload/SMS never hold DB locks, post-commit OTP/cooldown, failed-delivery cleanup, and connection cleanup. Simulated PG only.');
} finally { globalThis.fetch = originalFetch; db.restore(); }
