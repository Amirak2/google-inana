import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createAuthStore } from '../server/authStore.ts';
import { createApp } from '../server.ts';
const env = { SESSION_SECRET: 'sms-only-login-test-secret-longer-than-32', NODE_ENV: 'test' };
const store = new Store(env);
const auth = createAuthStore(store, env);
const app = createApp(store, env);
function otp(mobile, extra = {}) { store.set('otp', mobile, { mobile, code: '12345', attempts: 0, expiresAt: Date.now() + 180000, createdAt: Date.now(), ...extra }); }
async function request(path, body) {
  const response = await app.fetch(new Request(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { clientIp: '198.51.100.20' });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
}
const mobile = '09120000123';
assert.equal((await request('/api/auth/otp/verify', { mobile, code: '12345' })).status, 400);
assert.equal(auth.findUserByMobile(mobile), undefined);
otp(mobile);
assert.equal((await request('/api/auth/otp/verify', { mobile, code: '54321' })).status, 400);
assert.equal(auth.findUserByMobile(mobile), undefined);
const first = await request('/api/auth/otp/verify', { mobile, code: '12345' });
assert.equal(first.status, 200, JSON.stringify(first.body));
assert.equal(first.body.isNewUser, true);
assert.equal(first.body.user.role, 'customer');
assert.equal(first.body.user.phoneNumber, mobile);
assert.equal(first.body.user.username, undefined);
assert.equal(first.body.user.passwordHash, undefined);
assert.match(first.cookie, /HttpOnly/i);
assert.equal(auth.findUserByMobile(mobile).passwordHash, undefined);
assert.equal(store.map('otp').has(mobile), false);
assert.equal((await request('/api/auth/otp/verify', { mobile, code: '12345' })).status, 400);
otp(mobile);
const returning = await request('/api/auth/otp/verify', { mobile, code: '12345', username: 'ignored', password: 'ignored-password', role: 'admin' });
assert.equal(returning.body.user.uid, first.body.user.uid);
assert.equal(returning.body.user.role, 'customer');
assert.equal(returning.body.isNewUser, false);
assert.equal(auth.findUserByMobile(mobile).username, undefined);
const expiredMobile = '09120000124';
otp(expiredMobile, { expiresAt: Date.now() - 1 });
assert.equal((await request('/api/auth/otp/verify', { mobile: expiredMobile, code: '12345' })).status, 400);
assert.equal(auth.findUserByMobile(expiredMobile), undefined);
const adminMobile = '09128481806';
const adminBefore = auth.findUserByMobile(adminMobile);
otp(adminMobile);
const adminLogin = await request('/api/auth/otp/verify', { mobile: adminMobile, code: '12345' });
assert.equal(adminLogin.status, 200);
assert.equal(adminLogin.body.user.role, 'admin');
assert.equal(adminLogin.body.user.email, 'amirbiashad@gmail.com');
assert.equal(adminLogin.body.user.uid, adminBefore.uid);
for (const path of ['/api/auth/password/login', '/api/auth/password/set']) {
  assert.equal((await request(path, { username: 'any', password: 'any', code: '12345' })).status, 404);
}
console.log('PASS: SMS-only first/returning login, optional name, no password credentials, invalid/expired/replayed OTP rejection, secure cookie, admin identity preserved, password HTTP routes disabled. In-memory only.');
