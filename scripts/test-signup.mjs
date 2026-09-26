import assert from 'node:assert/strict';
import { createAuthStore } from '../server/authStore.ts';

function createStore() {
  const buckets = new Map();
  return {
    map(bucket) {
      if (!buckets.has(bucket)) buckets.set(bucket, new Map());
      return buckets.get(bucket);
    },
    tokenSet(bucket) {
      const values = this.map(bucket);
      return { has: (key) => values.has(key), add: (key) => values.set(key, true) };
    },
  };
}

function createAuth(store, extraEnv = {}) {
  return createAuthStore(store, {
    SESSION_SECRET: 'test-session-secret-at-least-32-characters',
    NODE_ENV: 'test',
    ...extraEnv,
  });
}

const previousWarn = console.warn;
console.warn = () => {};
try {
  const store = createStore();
  const auth = createAuth(store);
  const phone = '09120000001';

  const firstSend = await auth.sendSmsOtpCode(phone);
  assert.equal(firstSend.isRegistered, false);
  const firstCode = store.map('otp').get(phone).code;
  assert.throws(() => auth.verifySmsOtpAndAuthenticate(phone, firstCode.slice(0, 4)), /۵ رقم/);
  assert.equal(store.map('otp').get(phone).attempts, 0);
  const newAccount = auth.verifySmsOtpAndAuthenticate(phone, firstCode, 'مشتری آزمایشی');
  assert.equal(newAccount.isNewUser, true);
  assert.equal(newAccount.user.phoneNumber, phone);
  assert.equal(store.map('otp').has(phone), false);
  await auth.requestPhoneChangeOtp(newAccount.user.uid, '09120000005');
  const changeCode = store.map('phoneOtp').get(newAccount.user.uid).code;
  assert.throws(() => auth.verifyPhoneChangeOtp(newAccount.user.uid, changeCode.slice(0, 4)), /۵ رقم/);
  const changedProfile = auth.verifyPhoneChangeOtp(newAccount.user.uid, changeCode);
  assert.equal(changedProfile.uid, newAccount.user.uid);
  assert.equal(changedProfile.phoneNumber, '09120000005');
  assert.equal(auth.findUserByMobile(phone), undefined);

  const verifiedStore = createStore();
  verifiedStore.map('users').set('old@example.test', {
    uid: 'old-verified', email: 'old@example.test', displayName: 'مشتری قدیمی',
    phoneNumber: '09120000002', phoneVerified: true, passwordHash: 'legacy-hash',
    role: 'customer', createdAt: new Date().toISOString(),
  });
  const verifiedAuth = createAuth(verifiedStore);
  await verifiedAuth.sendSmsOtpCode('09120000002');
  const verifiedResult = verifiedAuth.verifySmsOtpAndAuthenticate('09120000002', verifiedStore.map('otp').get('09120000002').code);
  assert.equal(verifiedResult.user.uid, 'old-verified');
  assert.equal(verifiedResult.isNewUser, false);

  const legacyStore = createStore();
  legacyStore.map('users').set('legacy@example.test', {
    uid: 'old-unverified', email: 'legacy@example.test', displayName: 'مشتری قدیمی',
    phoneNumber: '09120000003', phoneVerified: false, passwordHash: 'legacy-hash',
    role: 'customer', createdAt: new Date().toISOString(),
  });
  const legacyAuth = createAuth(legacyStore);
  await assert.rejects(legacyAuth.sendSmsOtpCode('09120000003'), /حساب قدیمی/);
  assert.equal(legacyStore.map('otp').has('09120000003'), false);
  const legacyCode = '12345';
  legacyStore.map('otp').set('09120000003', { code: legacyCode, expiresAt: Date.now() + 180000, attempts: 0 });
  assert.throws(() => legacyAuth.verifySmsOtpAndAuthenticate('09120000003', legacyCode), /حساب قدیمی/);
  assert.equal(legacyStore.map('users').size, 2); // Existing user and seeded admin only.

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ success: false, data: false, error: 'rejected' }), { status: 200 });
    const smsStore = createStore();
    const smsAuth = createAuth(smsStore, { SMS_OTP_API_KEY: 'test-only-key' });
    await assert.rejects(smsAuth.sendSmsOtpCode('09120000004'), /تأیید نکرد/);
    assert.equal(smsStore.map('otp').has('09120000004'), false);
    globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data: true, code: 1 }), { status: 200 });
    await smsAuth.sendSmsOtpCode('09120000004');
    assert.equal(smsStore.map('otp').has('09120000004'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('Signup scenarios passed');
} finally {
  console.warn = previousWarn;
}
