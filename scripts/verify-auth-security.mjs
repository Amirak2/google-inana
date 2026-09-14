import assert from 'node:assert/strict';
import { createAuthStore } from '../server/authStore.ts';
const maps = new Map();
const store = { map(k) { if (!maps.has(k)) maps.set(k, new Map()); return maps.get(k); }, tokenSet(k) { return { has: t => this.map(k).has(t), add: t => this.map(k).set(t, {}) }; } };
const auth = createAuthStore(store, { SESSION_SECRET: 'local-security-test-secret-1234567890', ADMIN_EMAIL: 'admin@example.test', ADMIN_PHONE: '09120000000' });
const account = auth.registerUser('victim@example.test', 'Test-password-123', 'Test', '09121111111');
assert.equal(auth.findUserByMobile('09121111111'), undefined);
assert.throws(() => auth.syncGoogleUser({ uid: 'verified-google', email: 'victim@example.test', emailVerified: true }));
// Simulate an old password account that claimed an unverified phone.
store.map('users').get('victim@example.test').phoneNumber = '09121111111';
store.map('otp').set('09121111111', {code:'12345', expiresAt:Date.now()+180000, attempts:0});
const sms = auth.verifySmsOtpAndAuthenticate('09121111111', '12345');
assert.notEqual(sms.user.uid, account.user.uid);
assert.equal(auth.loginUser('victim@example.test', 'Test-password-123').user.uid, account.user.uid);
const google = auth.syncGoogleUser({uid:'google2', email:'new@example.test', emailVerified:true});
assert.equal(auth.syncGoogleUser({uid:'google2', email:'new@example.test', emailVerified:true}).user.uid, google.user.uid);
assert.throws(() => auth.syncGoogleUser({uid:'other', email:'new@example.test', emailVerified:true}));
assert.ok(auth.verifySessionToken(account.token));
console.log('PASS: unverified phone isolation, Google merge rejection, verified Google continuity, session validation');
