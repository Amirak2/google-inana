import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const script = await readFile(new URL('dist/server/index.js', root), 'utf8');
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script, compatibilityDate: '2026-09-01', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['BUCKET'], bindings: { SESSION_SECRET: 'test-secret-only-'.repeat(4), ADMIN_DEFAULT_PASSWORD: 'Test-admin-12345!', ADMIN_EMAIL: 'admin@example.com' }, serviceBindings: { ASSETS: async () => new Response(await readFile(new URL('dist/client/index.html', root)), { headers: { 'content-type': 'text/html' } }) } }));
const db = await mf.getD1Database('DB');
const migration = await readFile(new URL('drizzle/0000_greedy_trauma.sql', root), 'utf8');
for (const sql of migration.split('--> statement-breakpoint')) await db.prepare(sql.trim()).run();
async function call(path, method = 'GET', body, token, headers = {}) {
  const response = await mf.dispatchFetch('http://localhost' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  return { status: response.status, data };
}
try {
  assert.equal((await mf.dispatchFetch('http://localhost/')).status, 200);
  let result = await call('/api/settings'); assert.equal(result.status, 200, JSON.stringify(result));
  const products = await call('/api/products'); assert.equal(products.status, 200, JSON.stringify(products));
  assert.ok(Array.isArray(products.data) && products.data.length);
  const product = products.data[0];
  const admin = await call('/api/auth/login', 'POST', { email: 'admin@example.com', password: 'Test-admin-12345!' });
  assert.equal(admin.status, 200, JSON.stringify(admin));
  const registration = await call('/api/auth/register', 'POST', { email: 'customer@example.com', password: 'Test-customer-12345!', displayName: 'کاربر آزمایشی', phoneNumber: '09123456789' });
  assert.equal(registration.status, 201, JSON.stringify(registration));
  const token = registration.data.token;
  await db.prepare('INSERT OR REPLACE INTO site_records (bucket, record_key, value_json) VALUES (?, ?, ?)').bind('market', 'gold', JSON.stringify({ pricePerGram: 23000000, isManualOverride: true, status: 'manual', timestamp: new Date().toISOString() })).run();
  assert.equal((await call('/api/auth/me', 'GET', undefined, token)).status, 200);
  assert.equal((await call('/api/admin/logs', 'GET', undefined, token)).status, 403);
  const quote = await call('/api/orders/quote', 'POST', { items: [{ productId: product.id, quantity: 1 }] }, token);
  assert.equal(quote.status, 200, JSON.stringify(quote));
  const receipt = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXxkAAAAASUVORK5CYII=';
  const orderBody = { customerName: 'کاربر آزمایشی', customerPhone: '09123456789', customerAddress: 'تهران خیابان آزمایشی پلاک یک', contactMethod: 'phone', paymentMethod: 'card_to_card', paymentReceiptImage: receipt, items: [{ productId: product.id, quantity: 1 }], quoteId: quote.data.quoteId };
  const order = await call('/api/orders', 'POST', orderBody, token, { 'X-Idempotency-Key': 'test-order-1' });
  assert.equal(order.status, 201, JSON.stringify(order));
  assert.ok(order.data.order.paymentReceiptImage.startsWith('/api/receipts/'));
  const repeat = await call('/api/orders', 'POST', orderBody, token, { 'X-Idempotency-Key': 'test-order-1' });
  assert.equal(repeat.status, 200, JSON.stringify(repeat));
  assert.equal(repeat.data.order.id, order.data.order.id);
  const orders = await call('/api/orders', 'GET', undefined, token);
  assert.equal(orders.status, 200); assert.ok(JSON.stringify(orders.data).includes(order.data.order.id));
  const receiptPath = order.data.order.paymentReceiptImage;
  assert.equal((await mf.dispatchFetch('http://localhost' + receiptPath)).status, 403);
  assert.equal((await mf.dispatchFetch('http://localhost' + receiptPath, { headers: { Authorization: 'Bearer ' + token } })).status, 200);
  // Concurrent checkouts for the last unit must never oversell.
  const stockProduct = products.data[1];
  await db.prepare('UPDATE site_records SET value_json = ? WHERE bucket = ? AND record_key = ?').bind(JSON.stringify({ ...stockProduct, stock: 1 }), 'products', stockProduct.id).run();
  const concurrentBody = { ...orderBody, quoteId: undefined, items: [{ productId: stockProduct.id, quantity: 1 }] };
  const competing = await Promise.all([call('/api/orders', 'POST', concurrentBody, token, { 'X-Idempotency-Key': 'race-1' }), call('/api/orders', 'POST', concurrentBody, token, { 'X-Idempotency-Key': 'race-2' })]);
  assert.equal(competing.filter(r => r.status === 201).length, 1, JSON.stringify(competing));
  const remaining = await db.prepare('SELECT value_json FROM site_records WHERE bucket = ? AND record_key = ?').bind('products', stockProduct.id).first();
  assert.equal(JSON.parse(remaining.value_json).stock, 0);
  // Force a fresh Worker instance using the same durable services.
  await mf.setOptions(convertV4MiniflareOptions({ modules: true, script, compatibilityDate: '2026-09-01', compatibilityFlags: ['nodejs_compat'], d1Databases: ['DB'], r2Buckets: ['BUCKET'], bindings: { SESSION_SECRET: 'test-secret-only-'.repeat(4), ADMIN_DEFAULT_PASSWORD: 'Test-admin-12345!', ADMIN_EMAIL: 'admin@example.com' } }));
  assert.equal((await call('/api/auth/me', 'GET', undefined, token)).status, 200);
  assert.ok(JSON.stringify((await call('/api/orders', 'GET', undefined, token)).data).includes(order.data.order.id));
  assert.equal((await call('/api/auth/logout', 'POST', {}, token)).status, 200);
  assert.equal((await call('/api/auth/me', 'GET', undefined, token)).status, 401);
  const otp = await call('/api/auth/otp/send', 'POST', { mobile: '09121111111' });
  assert.equal(otp.status, 400); assert.ok(!JSON.stringify(otp.data).includes('isDevelopmentSimulation":true'));
  console.log('PASS: storefront, registration, login, authorization, quote, checkout, idempotency, private R2 receipt, Worker restart persistence, logout revocation, missing SMS configuration.');
} finally { await mf.dispose(); }
