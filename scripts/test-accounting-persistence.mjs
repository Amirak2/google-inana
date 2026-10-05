import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { runPostgresRequest, requestBuckets } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createAccounting, ACCOUNTING_BUCKETS } from '../server/accounting.ts';
import { emptyCosts, accountingDay } from '../src/utils/accounting.ts';

process.env.PG_URI = 'postgresql://unused/accounting';
const db = installFakePostgres();
const env = { SESSION_SECRET: 'accounting-persistence-isolated-secret-32chars', NODE_ENV: 'test' };
const deps = { externalize: async () => new Map(), migrate: async () => {} };
let token; let productId; let count = 0;
async function request(path, method = 'GET', body) {
  const req = new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const response = await runPostgresRequest(method, path.split('?')[0], env, (store, requestEnv) => createApp(store, requestEnv).fetch(req.clone()), deps);
  return { status: response.status, body: await response.json() };
}
async function mutation(action, body) {
  const data = (await request('/api/admin/accounting')).body;
  return request(`/api/admin/accounting/${action}`, 'POST', { actionId: `persist-accounting-${++count}`, expectedRevision: data.revision, ...body });
}
try {
  const seed = await PostgresStore.load(true);
  seed.set('market', 'gold', { pricePerGram: 24000000, isManualOverride: true }); createApp(seed, env);
  token = createAuthStore(seed, env).createSessionToken([...seed.map('users').values()].find(user => user.role === 'admin'));
  const product = [...seed.map('products').values()][0]; productId = product.id; product.stock = 2; seed.set('products', product.id, product);
  await seed.commit(); await seed.release();
  const date = accountingDay();
  assert.equal((await mutation('purchase', { productId, kind: 'opening', quantity: 2, costs: { ...emptyCosts(), gold: 100 }, date })).status, 200);
  const firstData = (await request('/api/admin/accounting')).body;
  assert.equal(firstData.purchases.length, 1, 'New request must read persisted purchases');
  const body = { expectedRevision: firstData.revision, customerName: 'فروش هم‌زمان', items: [{ productId, quantity: 2, unitPrice: 200 }], date };
  const results = await Promise.all([
    request('/api/admin/accounting/sale', 'POST', { ...body, actionId: 'concurrent-accounting-one' }),
    request('/api/admin/accounting/sale', 'POST', { ...body, actionId: 'concurrent-accounting-two' }),
  ]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(db.get('products', productId).stock, 0, 'Concurrent Instagram sales cannot oversell');
  const sale = results.find(result => result.status === 200).body.result;
  const paymentData = (await request('/api/admin/accounting')).body;
  const paymentBody = { actionId: 'persist-receipt-retry', expectedRevision: paymentData.revision, saleId: sale.id,
    kind: 'receipt', method: 'card_to_card', amount: 400, fee: 0, reference: 'PERSIST-RECEIPT', note: 'پرداخت', date };
  assert.equal((await request('/api/admin/accounting/money', 'POST', paymentBody)).status, 200);
  assert.equal((await request('/api/admin/accounting/money', 'POST', paymentBody)).status, 200);
  assert.equal((await request('/api/admin/accounting')).body.money.length, 1, 'Idempotency survives separate database snapshots');
  assert.equal((await mutation('complete', { saleId: sale.id, date })).status, 200);
  assert.equal((await request('/api/admin/accounting')).body.totals[sale.id].profit, 200);
  db.set('products', productId, { ...db.get('products', productId), stock: 1 });
  const beforeBad = db.get('products', productId).stock;
  const salesBeforeBad = (await request('/api/admin/accounting')).body.sales.length;
  assert.equal((await mutation('sale', { customerName: 'خطا', exchangeForSaleId: 'missing-return', items: [{ productId, quantity: 1, unitPrice: 200 }], date })).status, 404);
  assert.equal(db.get('products', productId).stock, beforeBad, 'Late failure rolls back inventory deduction');
  assert.equal((await request('/api/admin/accounting')).body.sales.length, salesBeforeBad, 'Late failure rolls back the new order and accounting snapshot');
  const publicStore = await PostgresStore.load(false, true);
  for (const bucket of ACCOUNTING_BUCKETS) assert.equal(publicStore.map(bucket).size, 0, 'Public snapshots exclude every financial dataset');
  await publicStore.release();
  const publicQueries = db.events.filter(event => event.startsWith('SELECT bucket') && event.includes('bucket NOT IN'));
  assert.ok(publicQueries.some(query => query.includes("'accountingSales'")));
  assert.ok(ACCOUNTING_BUCKETS.every(bucket => requestBuckets('/api/orders').includes(bucket)));
  assert.ok(ACCOUNTING_BUCKETS.every(bucket => !requestBuckets('/api/settings').includes(bucket)));
  const recovered = await PostgresStore.load(false);
  assert.equal(createAccounting(recovered).snapshot().totals[sale.id].cost, 200);
  await recovered.release();
  assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
  console.log('PASS: PostgreSQL financial persistence, exact payment replay, atomic concurrent Instagram sales, private bucket exclusion, request scoping and no transaction leaks.');
} finally { db.restore(); }
