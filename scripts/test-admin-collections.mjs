import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { INITIAL_COLLECTIONS } from '../src/data/seedData.ts';

process.env.PG_URI = 'postgresql://unused/collections';
const db = installFakePostgres();
const env = { SESSION_SECRET: 'admin-collections-isolated-secret-32chars!', NODE_ENV: 'test' };
const deps = { externalize: async () => new Map(), migrate: async () => {} };
let token = '';
async function request(path, method = 'GET', body) {
  const req = new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const response = await runPostgresRequest(method, path, env, (store, requestEnv) => createApp(store, requestEnv).fetch(req.clone()), deps);
  return { status: response.status, body: await response.json() };
}

const seed = await PostgresStore.load(true);
createApp(seed, env);
const admin = [...seed.map('users').values()].find(user => user.role === 'admin');
const adminToken = createAuthStore(seed, env).createSessionToken(admin);
const pearl = [...seed.map('products').values()].find(product => product.collection === 'INANA PEARLS');
await seed.commit(); await seed.release();

// The site keeps showing exactly the collections it showed before.
const initial = await request('/api/collections');
assert.deepEqual(initial.body.map(c => c.name), INITIAL_COLLECTIONS.map(c => c.name));

// Only the admin can change collections.
assert.equal((await request('/api/admin/collections', 'POST', { titleFa: 'ماه', name: 'INANA MOON', coverImage: '/x.webp' })).status, 401);
token = adminToken;
assert.equal((await request('/api/admin/collections', 'POST', { titleFa: 'ماه', name: 'ماه', coverImage: '/x.webp' })).status, 400, 'English name must be in English');
assert.equal((await request('/api/admin/collections', 'POST', { titleFa: 'ماه', name: 'INANA MOON' })).status, 400, 'A cover photo is required');
assert.equal((await request('/api/admin/collections', 'POST', { titleFa: 'تکراری', name: 'inana pearls', coverImage: '/x.webp' })).status, 400, 'Names stay unique');

const created = await request('/api/admin/collections', 'POST', { titleFa: 'کالکشن ماه', name: 'inana moon', subtitleFa: 'زیرعنوان', coverImage: '/products/pearls/p3-white.png' });
assert.equal(created.status, 200);
assert.equal(created.body.name, 'INANA MOON');
let list = (await request('/api/collections')).body;
assert.equal(list.at(-1).titleFa, 'کالکشن ماه', 'A new collection is added at the end and persists');

// Reorder: the new collection moves to the front.
const reordered = await request('/api/admin/collections/order', 'PUT', { ids: [created.body.id] });
assert.equal(reordered.body[0].id, created.body.id);
assert.equal((await request('/api/collections')).body[0].id, created.body.id);

// Renaming moves the collection's products along.
const pearls = list.find(c => c.name === 'INANA PEARLS');
const renamed = await request(`/api/admin/collections/${pearls.id}`, 'PUT', { name: 'INANA PEARL LINE', titleFa: 'مروارید' });
assert.equal(renamed.status, 200);
assert.equal(renamed.body.movedProducts > 0, true);
assert.equal(db.get('products', pearl.id).collection, 'INANA PEARL LINE');

// Delete removes the collection only; its products stay.
assert.equal((await request(`/api/admin/collections/${created.body.id}`, 'DELETE')).status, 200);
list = (await request('/api/collections')).body;
assert.ok(!list.some(c => c.id === created.body.id));
assert.ok(db.get('products', pearl.id), 'Products are never deleted with a collection');
assert.equal((await request('/api/admin/collections/missing', 'DELETE')).status, 404);

const admin_ui = await readFile(new URL('../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
assert.ok(admin_ui.includes("{ id: 'collections', label: 'کالکشن‌ها', icon: Layers }") && admin_ui.includes('<AdminCollections />'));
assert.ok(admin_ui.includes('<option value="">بدون کالکشن</option>'), 'The product form picks a collection from the list');
console.log('PASS: admin can add, rename (moving products), reorder and delete collections; the site shows them in order.');
