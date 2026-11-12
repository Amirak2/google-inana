import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { requestBuckets } from '../server/postgresRequest.ts';

const env = { SESSION_SECRET: 'isolated-admin-users-list-secret-32chars', NODE_ENV: 'test' };
const store = new Store(env); createApp(store, env);
const auth = createAuthStore(store, env);
const admin = [...store.map('users').values()].find(user => user.role === 'admin');
const customer = { uid: 'list-customer', role: 'customer', phoneNumber: '09121110000', phoneVerified: true, email: 'list-customer@users.inanagold.invalid',
  displayName: 'مشتری فهرست', address: 'نشانی آزمایشی', createdAt: '2026-11-01T10:00:00.000Z', passwordHash: 'secret-hash-fixture', salt: 'secret-salt-fixture' };
const visitor = { uid: 'list-visitor', role: 'customer', phoneNumber: '09121110001', email: 'list-visitor@users.inanagold.invalid', displayName: 'بازدیدکننده', createdAt: '2026-11-05T10:00:00.000Z' };
store.set('users', customer.email, customer); store.set('users', visitor.email, visitor);
const order = (id, status, totalPrice, createdAt) => ({ id, trackingCode: id.toUpperCase(), userId: customer.uid, customerName: customer.displayName, customerPhone: customer.phoneNumber,
  status, totalPrice, createdAt, items: [], inventoryReleased: true });
store.set('orders', 'u-done', order('u-done', 'تکمیل شده', 3_000_000, '2026-11-02T10:00:00.000Z'));
store.set('orders', 'u-approved', order('u-approved', 'تأیید شده', 2_000_000, '2026-11-06T10:00:00.000Z'));
store.set('orders', 'u-pending', order('u-pending', 'در انتظار بررسی', 9_000_000, '2026-11-07T10:00:00.000Z'));
store.set('orders', 'u-rejected', order('u-rejected', 'رد شده', 7_000_000, '2026-11-03T10:00:00.000Z'));

async function request(token) {
  const response = await createApp(store, env).fetch(new Request('http://localhost/api/admin/users', { headers: token ? { Authorization: `Bearer ${token}` } : {} }));
  return { status: response.status, data: await response.json() };
}
assert.equal((await request()).status, 401, 'Signed-out visitors cannot list users');
assert.equal((await request(auth.createSessionToken(customer))).status, 403, 'Customers cannot list users');

const { status, data } = await request(auth.createSessionToken(admin));
assert.equal(status, 200);
assert.equal(data.total, store.map('users').size);
const position = uid => data.users.findIndex(user => user.uid === uid);
assert.ok(position(visitor.uid) < position(customer.uid), 'Newer accounts come first');
const row = data.users.find(user => user.uid === customer.uid);
assert.deepEqual({ name: row.displayName, phone: row.phoneNumber, role: row.role, verified: row.phoneVerified, address: row.address },
  { name: 'مشتری فهرست', phone: '09121110000', role: 'customer', verified: true, address: 'نشانی آزمایشی' });
assert.equal(row.ordersCount, 4);
assert.equal(row.paidOrdersCount, 2, 'Pending and rejected orders are not counted as purchases');
assert.equal(row.paidTotal, 5_000_000);
assert.equal(row.lastOrderAt, '2026-11-07T10:00:00.000Z');
const empty = data.users.find(user => user.uid === visitor.uid);
assert.deepEqual([empty.ordersCount, empty.paidTotal, empty.lastOrderAt], [0, 0, null]);
assert.equal(data.users.find(user => user.uid === admin.uid).role, 'admin');

// Credentials never leave the server, whatever fields a stored account carries.
const serialized = JSON.stringify(data);
for (const secret of ['secret-hash-fixture', 'secret-salt-fixture', 'passwordHash', 'salt', 'authVersion']) assert.ok(!serialized.includes(secret), `${secret} must not be exposed`);

// The production request snapshot includes what the list reads.
for (const bucket of ['users', 'orders']) assert.ok(requestBuckets('/api/admin/users').includes(bucket));
console.log('PASS: admin-only user list with order totals, newest first, and no credentials in the response.');
