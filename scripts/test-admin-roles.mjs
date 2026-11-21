import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';

process.env.PG_URI = 'postgresql://unused/roles';
const db = installFakePostgres();
const env = { SESSION_SECRET: 'admin-roles-isolated-test-secret-32chars!!', NODE_ENV: 'test' };
const deps = { externalize: async () => new Map(), migrate: async () => {} };
async function request(token, path, method = 'GET', body) {
  const req = new Request(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const response = await runPostgresRequest(method, path, env, (store, requestEnv) => createApp(store, requestEnv).fetch(req.clone()), deps);
  return { status: response.status, body: await response.json() };
}

const seed = await PostgresStore.load(true);
createApp(seed, env);
const staff = (uid, phone) => ({ uid, email: `${uid}@phone.inana.local`, username: uid, displayName: uid, phoneNumber: phone, role: 'customer', authVersion: 0, passwordHash: '', salt: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
seed.set('users', 'hengameh@phone.inana.local', staff('hengameh', '09120000011'));
seed.set('users', 'aida@phone.inana.local', staff('aida', '09120000012'));
const auth = createAuthStore(seed, env);
const owner = auth.createSessionToken([...seed.map('users').values()].find(user => user.uid === 'ina_admin_master'));
const hengameh = auth.createSessionToken(seed.get('users', 'hengameh@phone.inana.local'));
const aida = auth.createSessionToken(seed.get('users', 'aida@phone.inana.local'));
await seed.commit(); await seed.release();

assert.equal((await request(hengameh, '/api/admin/users')).status, 403, 'A customer cannot open the admin panel');
assert.equal((await request(hengameh, '/api/admin/users/aida/role', 'PUT', { role: 'admin' })).status, 403, 'A customer cannot give admin access');

// The owner gives admin access; it works at once with the session the person already has.
const granted = await request(owner, '/api/admin/users/hengameh/role', 'PUT', { role: 'admin' });
assert.equal(granted.status, 200);
assert.equal(granted.body.user.role, 'admin');
assert.equal(db.get('users', 'hengameh@phone.inana.local').role, 'admin', 'Saved permanently');
assert.equal((await request(hengameh, '/api/admin/users')).status, 200, 'The new admin can open the admin panel');

// Only the owner hands out access, and the owner's master account cannot be changed.
assert.equal((await request(hengameh, '/api/admin/users/aida/role', 'PUT', { role: 'admin' })).status, 403, 'Other admins cannot make more admins');
assert.equal((await request(hengameh, '/api/admin/users/ina_admin_master/role', 'PUT', { role: 'customer' })).status, 403);
assert.equal((await request(owner, '/api/admin/users/ina_admin_master/role', 'PUT', { role: 'customer' })).status, 400, 'The master account stays admin');
assert.equal((await request(owner, '/api/admin/users/aida/role', 'PUT', { role: 'superuser' })).status, 400);
assert.equal((await request(owner, '/api/admin/users/nobody/role', 'PUT', { role: 'admin' })).status, 404);

// Removing access takes effect immediately.
assert.equal((await request(owner, '/api/admin/users/hengameh/role', 'PUT', { role: 'customer' })).status, 200);
assert.equal((await request(hengameh, '/api/admin/users')).status, 403);
assert.equal((await request(aida, '/api/admin/users')).status, 403);

const ui = await readFile(new URL('../src/components/AdminUsers.tsx', import.meta.url), 'utf8');
assert.ok(ui.includes("const isOwner = currentUser?.uid === 'ina_admin_master';") && ui.includes('دادن دسترسی مدیر'), 'Only the owner sees the button');
console.log('PASS: only the owner can give or remove admin access; it applies immediately and the master account is protected.');
