import assert from 'node:assert/strict';
import sharp from 'sharp';
import express from 'express';
import http from 'node:http';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createLogger } from '../server/logger.ts';
import { validateReceipt } from '../server/receiptValidation.ts';
import { securityHeaders } from '../server/securityHeaders.ts';

process.env.PG_URI = 'postgresql://unused/security-abuse';
const db = installFakePostgres();
const originalNow = Date.now, originalFetch = globalThis.fetch;
let now = originalNow();
Date.now = () => now;
globalThis.fetch = async () => { throw new Error('No external service may be called by abuse tests'); };
const env = { SESSION_SECRET: 'isolated-security-abuse-secret-longer-than-32', NODE_ENV: 'test' };
const deps = { externalize: async () => new Map(), migrate: async () => {} };
const users = Array.from({ length: 6 }, (_, i) => ({ uid: `security-user-${i}`, email: `security${i}@example.test`, displayName: 'مشتری آزمایشی', phoneNumber: `09120000${String(i).padStart(3, '0')}`, role: 'customer', phoneVerified: true, createdAt: new Date().toISOString() }));
let tokens, adminToken, products;
async function request(path, method = 'GET', body, token, ip = '198.51.100.201') {
  const req = new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const response = await runPostgresRequest(method, path.split('?')[0], env, (store, requestEnv) => createApp(store, requestEnv).fetch(req.clone(), { clientIp: ip }), deps);
  return { status: response.status, headers: response.headers, body: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() };
}
try {
  const seed = await PostgresStore.load(true);
  seed.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
  createApp(seed, env);
  const auth = createAuthStore(seed, env);
  adminToken = auth.createSessionToken([...seed.map('users').values()].find(u => u.role === 'admin'));
  for (const user of users) seed.set('users', user.email, user);
  tokens = users.map(user => auth.createSessionToken(user));
  products = [...seed.map('products').values()].map(p => ({ ...p, stock: 10 }));
  for (const p of products) seed.set('products', p.id, p);
  await seed.commit(); await seed.release();

  // Signature-only, truncated data, wrong MIME, tiny images and pixel bombs.
  const validBuffer = await sharp({ create: { width: 128, height: 128, channels: 3, background: 'white' } }).png().toBuffer();
  const receipt = 'data:image/png;base64,' + validBuffer.toString('base64');
  const signatures = [Buffer.from([137,80,78,71,13,10,26,10]), validBuffer.subarray(0, validBuffer.length - 50)];
  for (const bytes of signatures) assert.ok(await validateReceipt('data:image/png;base64,' + bytes.toString('base64')));
  assert.ok(await validateReceipt(receipt.replace('image/png', 'image/jpeg')));
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toBuffer();
  assert.ok(await validateReceipt('data:image/png;base64,' + tiny.toString('base64')));
  const bomb = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: 'white' } }).png().toBuffer();
  assert.ok(await validateReceipt('data:image/png;base64,' + bomb.toString('base64')));
  for (const format of ['png', 'jpeg', 'webp', 'gif']) {
    const bytes = await sharp(validBuffer).toFormat(format).toBuffer();
    assert.equal(await validateReceipt(`data:image/${format};base64,` + bytes.toString('base64')), null);
  }
  // Keep quota fixtures within the 50-row cart limit as the catalog grows.
  const items = products.slice(0, 7).map(p => ({ productId: p.id, quantity: 1 }));
  assert.equal(items.length, 7, 'Quota scenarios require seven distinct products');
  const payload = (selected, image = receipt) => ({ customerName: 'مشتری آزمایشی', customerPhone: users[0].phoneNumber, customerAddress: 'تهران خیابان آزمایشی پلاک یک', items: selected, paymentReceiptImage: image });
  assert.equal((await request('/api/orders', 'POST', payload(items, 'data:image/png;base64,iVBORw0KGgo='), tokens[0])).status, 400);
  assert.equal((await request('/api/orders', 'POST', payload(items), tokens[0])).status, 429);
  assert.ok(products.every(p => db.get('products', p.id).stock === 10));

  // Drafts never hold stock; payment quotes and pending orders share the capacity cap.
  assert.equal((await request('/api/cart/reserve-batch', 'POST', { items }, tokens[1])).status, 200);
  assert.ok(products.every(p => db.get('products', p.id).stock === 10));
  assert.equal((await request('/api/orders/quote', 'POST', { items }, tokens[1])).status, 429);
  const first = await request('/api/orders/quote', 'POST', { items: items.slice(0, 3) }, tokens[1]);
  assert.equal(first.status, 200);
  assert.equal(first.body.expiresAt, now + 5 * 60000);
  now += 5 * 60000;
  const repeat = await request('/api/cart/reserve-batch', 'POST', { items: items.slice(0, 3) }, tokens[1]);
  assert.equal(repeat.status, 200);
  assert.equal(repeat.body.reserved, false, 'Drafts cannot create or extend payment reservations');
  const quote = await request('/api/orders/quote', 'POST', { items: items.slice(0, 3) }, tokens[1]);
  assert.equal(quote.status, 200);
  assert.equal(quote.body.expiresAt, now + 5 * 60000, 'Checkout reserves inventory for five minutes');
  await request('/api/cart/release-reservation', 'POST', {}, tokens[1]);
  assert.equal((await request('/api/orders/quote', 'POST', { items: items.slice(3, 4) }, tokens[1])).status, 429);
  now += 26 * 60000;
  assert.equal((await request('/api/orders/quote', 'POST', { items: items.slice(0, 1) }, tokens[1])).status, 429, 'Release/recreate cannot reset the owner hold budget');
  now += 15 * 60000;
  assert.equal((await request('/api/orders/quote', 'POST', { items: items.slice(0, 1) }, tokens[1])).status, 200);

  // Concurrent quotes cannot race past the per-account product quota.
  const raced = await Promise.all([
    request('/api/orders/quote', 'POST', { items: items.slice(0, 2) }, tokens[2]),
    request('/api/orders/quote', 'POST', { items: items.slice(2, 4) }, tokens[2]),
  ]);
  assert.deepEqual(raced.map(r => r.status).sort(), [200, 429]);

  // Unverified orders are capped; after the hold expires, stock returns exactly once.
  const order = await request('/api/orders', 'POST', payload(items.slice(4, 5)), tokens[3]);
  assert.equal(order.status, 201);
  assert.equal((await request('/api/orders', 'POST', payload(items.slice(5, 6)), tokens[3])).status, 201);
  assert.equal((await request('/api/orders', 'POST', payload(items.slice(6, 7)), tokens[3])).status, 429);
  assert.equal((await request('/api/cart/reserve-batch', 'POST', { items: items.slice(6, 7) }, tokens[3])).status, 200, 'Draft validation does not consume pending-order slots');
  assert.equal((await request('/api/orders/quote', 'POST', { items: items.slice(6, 7) }, tokens[3])).status, 429, 'Pending-order caps must be enforced BEFORE the customer pays');
  const id = order.body.order.id, productId = items[4].productId;
  assert.equal(db.get('products', productId).stock, 9);
  now += 48 * 3600000;
  assert.equal((await request('/api/products')).status, 200);
  const expired = db.get('orders', id);
  assert.equal(db.get('products', productId).stock, 10);
  assert.equal(expired.inventoryReleased, true);
  assert.equal(expired.paymentReviewRequired, true);
  assert.ok(expired.inventoryHoldExpiredAt);
  assert.equal(expired.totalPrice, order.body.order.totalPrice);
  assert.equal(expired.paymentReceiptImage, receipt);
  await Promise.all([request('/api/products'), request('/api/orders', 'GET', undefined, tokens[3])]);
  assert.equal(db.get('products', productId).stock, 10);
  db.set('products', productId, { ...db.get('products', productId), stock: 0 });
  assert.equal((await request(`/api/orders/${id}/status`, 'PATCH', { status: 'تایید شده' }, adminToken)).status, 409);
  db.set('products', productId, { ...db.get('products', productId), stock: 1 });
  assert.equal((await request(`/api/orders/${id}/status`, 'PATCH', { status: 'تایید شده' }, adminToken)).status, 200);
  assert.equal(db.get('products', productId).stock, 0);
  await request(`/api/orders/${id}/status`, 'PATCH', { status: 'لغو شده' }, adminToken);
  await request(`/api/orders/${id}/status`, 'PATCH', { status: 'لغو شده' }, adminToken);
  assert.equal(db.get('products', productId).stock, 1);

  // Client reports cannot forge trusted event labels, and CSV escapes every cell.
  const spoofed = await request('/api/logs', 'POST', { module: 'ADMIN', level: 'security', message: '=1+1', details: { clientReported: false } });
  assert.equal(spoofed.status, 201);
  assert.equal(spoofed.body.log.module, 'CLIENT');
  assert.equal(spoofed.body.log.level, 'info');
  assert.equal(spoofed.body.log.details.clientReported, true);
  const dangerous = ['=1+1', '+1', '-1', '@SUM(1)', '\t=1', '\r=1', '\n=1', '  =1', '\ufeff=1', '＝1', '＋1', '－1', '＠1', 'comma,"\n=1'];
  const logStore = await PostgresStore.load(true);
  const { logger } = createLogger(logStore);
  for (const text of dangerous) logger.info('CLIENT', text, {}, { ip: text, userEmail: text });
  const csv = logger.exportCsv();
  assert.ok(csv.includes('"\t\'=1+1"'));
  assert.ok(csv.includes('"\t\'  =1"'));
  assert.ok(csv.includes('"comma,""\n=1"'));
  for (const text of dangerous.slice(0, -1)) assert.ok(csv.includes(`"\t'${text}"`));
  await logStore.commit(); await logStore.release();
  assert.equal((await request('/api/admin/logs')).status, 401);
  assert.equal((await request('/api/orders')).status, 401);

  // Unauthenticated random logout tokens never enter the durable revocation set.
  for (let i = 0; i < 30; i++) assert.equal((await request('/api/auth/logout', 'POST', {}, `never-valid-${i}`, '198.51.100.240')).status, 200);
  assert.equal((await request('/api/auth/logout', 'POST', {}, 'never-valid-more', '198.51.100.240')).status, 429);
  const inspect = await PostgresStore.load(false);
  assert.equal(inspect.map('revoked').size, 0);
  await inspect.release();
  assert.equal((await request('/api/auth/logout', 'POST', {}, tokens[5], '198.51.100.240')).status, 200, 'A real session must be able to log out despite an exhausted shared-IP anonymous quota');
  assert.ok(db.get('revoked', tokens[5]));
  assert.equal((await request('/api/auth/me', 'GET', undefined, tokens[5])).status, 401);
  await request('/api/auth/logout', 'POST', {}, tokens[5], '198.51.100.241');
  assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);

  // Actual Express response: headers apply to HTML and error responses as well.
  const app = express(); app.disable('x-powered-by'); app.use(securityHeaders);
  app.get('/', (_req, res) => res.type('html').send('<!doctype html><p>test</p>'));
  app.get('/failure', (_req, res) => res.sendStatus(503));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const path of ['/', '/failure']) {
      const response = await new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port: server.address().port, path }, res => { res.resume(); res.on('end', () => resolve(res)); }).on('error', reject);
      });
      assert.match(response.headers['content-security-policy'], /script-src 'self'/);
      assert.match(response.headers['content-security-policy'], /frame-ancestors 'none'/);
      assert.equal(response.headers['strict-transport-security'], 'max-age=31536000');
      assert.equal(response.headers['x-frame-options'], 'DENY');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['x-powered-by'], undefined);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: decoded receipts, pixel limits, account stock/pending caps, non-renewable draft/quote budget, concurrent quota guards, 48h durable exact-once release and safe approval, logout forgery/rate/revocation, client log provenance, CSV formula protection, HTML/error security headers. All data/services isolated; simulated PG only.');
} finally { Date.now = originalNow; globalThis.fetch = originalFetch; db.restore(); }

