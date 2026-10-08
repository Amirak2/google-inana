import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// Render the real auth provider and checkout. Only cart data and decorative canvas
// are replaced; requests use a fake server and never send SMS or create live orders.
const { build } = await import(process.platform === 'win32' ? 'esbuild-wasm' : 'esbuild');
const output = new URL('../node_modules/.cache/account-checkout.mjs', import.meta.url);
await mkdir(new URL('./', output), { recursive: true });
const bundle = await build({
  stdin: { contents: `
    import React from 'react';
    import { AuthProvider, useAuth } from './src/context/AuthContext';
    import { CartDrawer } from './src/components/CartDrawer';
    import { DEFAULT_SETTINGS } from './src/utils/pricingEngine';
    import { PEARL_PRODUCTS } from './src/data/seedData';
    globalThis.checkoutStore = {cart: [{product: PEARL_PRODUCTS[0], quantity: 1}],
      isCartOpen: true, goldPrice: {pricePerGram: 23932462}, settings: DEFAULT_SETTINGS,
      setIsCartOpen() {}, removeFromCart() {}, updateCartQuantity() {}, refreshProducts() {},
      clearCart() {globalThis.clearCount++;}};
    function Probe() { globalThis.authHarness = useAuth(); return <CartDrawer/>; }
    export function Harness() { return <AuthProvider><Probe/></AuthProvider>; }
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  plugins: [{ name: 'checkout-fixtures', setup(api) {
    api.onResolve({ filter: /GoldStoreContext$/ }, () => ({ path: 'cart', namespace: 'fixture' }));
    api.onResolve({ filter: /^canvas-confetti$/ }, () => ({ path: 'confetti', namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'cart'
      ? 'export function useGoldStore() { return globalThis.checkoutStore; }'
      : 'export default function confetti() {}' }));
  }}],
});
await writeFile(output, bundle.outputFiles[0].contents);
const dom = new JSDOM('<div id="app"></div>', { url: 'https://local.test/' });
for (const name of ['window', 'document', 'localStorage', 'FileReader', 'File', 'HTMLElement', 'HTMLInputElement']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.Image = class { width = 1; height = 1; set src(value) { queueMicrotask(() => this.onload()); } };
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
globalThis.clearCount = 0;
const first = {uid: 'first', email: 'first@local.test', displayName: 'خریدار اول',
  phoneNumber: '09121111111', address: 'آدرس خصوصی خریدار اول، پلاک ۱۰', role: 'user'};
const second = {...first, uid: 'second', email: 'second@local.test', displayName: 'خریدار دوم',
  phoneNumber: '09122222222', address: 'آدرس خریدار دوم، پلاک ۲۰'};
let serverUser = first;
let pendingProfile, pendingOrder;
let delayProfile = false, delayOrder = false;
let delayMe = false, pendingMe;
const json = (data) => new Response(JSON.stringify(data), {status: 200});
globalThis.fetch = async (url, options = {}) => {
  if (url === '/api/auth/me') {
    if (delayMe) return new Promise(resolve => {pendingMe = () => resolve(json({user: first}));});
    return json({user: serverUser});
  }
  if (url === '/api/auth/profile') {
    const result = json({success: true, user: {...serverUser, ...JSON.parse(options.body)}});
    if (delayProfile) return new Promise(resolve => {pendingProfile = () => resolve(result);});
    return result;
  }
  if (url === '/api/auth/logout') {serverUser = null; return json({success: true});}
  if (url === '/api/auth/otp/verify') {serverUser = second; return json({success: true, user: second});}
  if (url === '/api/orders/quote') return json({quoteId: 'q', expiresAt: Date.now() + 300000,
    totalPrice: 7000000, goldPriceAtQuote: 23932462});
  if (url === '/api/orders') {
    const result = json({order: {id: 'order-first', trackingCode: 'FIRST-ORDER', ...JSON.parse(options.body),
      totalPrice: 7000000, items: [], createdAt: Date.now(), status: 'pending'}});
    if (delayOrder) return new Promise(resolve => {pendingOrder = () => resolve(result);});
    return result;
  }
  throw new Error(`Unexpected request: ${url}`);
};
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');
const { Harness } = await import(output.href);
const root = createRoot(document.getElementById('app'));
const settle = () => new Promise(resolve => setTimeout(resolve, 20));
async function click(text) {
  const button = [...document.querySelectorAll('button')].find(item => item.textContent.includes(text));
  assert.ok(button, `Missing button: ${text}`);
  assert.equal(button.disabled, false, text);
  await act(async () => {button.click(); await settle();});
}
async function checkout(expectedName = authHarness.userProfile.displayName, testExpiry = false) {
  await click('ادامه و ثبت مشخصات خریدار');
  assert.equal(document.querySelector('input[placeholder="مثال: سارا محمدی"]').value, expectedName);
  await click('ثبت اطلاعات و رفتن به صفحه کارت به کارت');
  assert.ok(document.body.textContent.includes('رزرو کالا و تضمین مبلغ پرداخت (۵ دقیقه)'), 'Customer sees five-minute reservation');
  assert.ok(document.body.textContent.includes('پس از پایان مهلت، رزرو خودکار آزاد می‌شود.'), 'Customer knows what happens at expiry');
  assert.ok(document.body.textContent.includes('زمان باقی‌ماندهٔ رزرو:'), 'Countdown is visible at payment');
  if (testExpiry) {
    const realNow = Date.now, expiredNow = realNow() + 300001;
    try {
      Date.now = () => expiredNow;
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
      assert.ok(document.body.textContent.includes('مهلت رزرو تمام شد و کالا برای سایر مشتریان آزاد شد.'), 'Expiry explains stock release');
      await click('واریز نکرده‌ام؛ دریافت نرخ جدید');
      assert.ok(document.body.textContent.includes('زمان باقی‌ماندهٔ رزرو:'), 'Customer can start a new payment window before paying');
    } finally { Date.now = realNow; }
  }
  const input = document.querySelector('input[type="file"]');
  assert.ok(input);
  Object.defineProperty(input, 'files', {value: [new File(['receipt'], 'receipt.png', {type: 'image/png'})]});
  await act(async () => {input.dispatchEvent(new dom.window.Event('change', {bubbles: true})); await settle();});
  assert.ok(document.querySelector('img[src^="data:"]'), 'Receipt preview must be present');
}
try {
  await act(async () => {root.render(React.createElement(Harness)); await settle();});
  assert.equal(authHarness.currentUser.uid, first.uid);
  assert.equal(localStorage.getItem('inana_user_session'), null);
  await act(async () => {await authHarness.updateUserProfileData({displayName: 'نام ویرایش‌شده'});});
  assert.equal(authHarness.userProfile.displayName, 'نام ویرایش‌شده', 'Cookie session must support profile editing after refresh');
  assert.equal(localStorage.getItem('inana_user_session'), null, 'Profile must not be persisted in browser storage');
  await checkout(first.displayName, true);
  await click('تأیید نهایی و ارسال فیش');
  assert.ok(document.body.textContent.includes('FIRST-ORDER'));
  await act(async () => {await authHarness.logout();});
  await act(async () => {await authHarness.verifySmsOtp(second.phoneNumber, '12345');});
  assert.equal(document.body.textContent.includes('FIRST-ORDER'), false, 'Confirmation from another account must be cleared');
  assert.equal(document.querySelector('img[src^="data:"]'), null, 'Receipt from another account must be cleared');
  await click('ادامه و ثبت مشخصات خریدار');
  assert.equal(document.querySelector('input[placeholder="مثال: سارا محمدی"]').value, second.displayName);
  assert.equal(document.querySelector('textarea').value, second.address);
  assert.equal(document.body.textContent.includes(first.address), false);
  // An old profile response cannot replace the account selected while it was in flight.
  delayProfile = true;
  let profileRequest;
  await act(async () => {profileRequest = authHarness.updateUserProfileData({displayName: 'OLD-RESPONSE'}); await settle();});
  await act(async () => {await authHarness.logout();});
  await act(async () => {await authHarness.verifySmsOtp(second.phoneNumber, '12345');});
  await act(async () => {pendingProfile(); await profileRequest;});
  assert.equal(authHarness.userProfile.displayName, second.displayName);
  // Late checkout success must not clear the next account's cart.
  await checkout();
  delayOrder = true;
  await click('تأیید نهایی و ارسال فیش');
  const before = clearCount;
  await act(async () => {await authHarness.logout();});
  await act(async () => {await authHarness.verifySmsOtp(second.phoneNumber, '12345');});
  await act(async () => {pendingOrder(); await settle();});
  assert.equal(clearCount, before);
  assert.equal(document.body.textContent.includes('FIRST-ORDER'), false);
  delayMe = true;
  await act(async () => {root.render(React.createElement(Harness, {key: 'reload'})); await settle();});
  assert.equal(authHarness.loading, true);
  await act(async () => {await authHarness.verifySmsOtp(second.phoneNumber, '12345');});
  assert.equal(authHarness.loading, false, 'Successful login must finish loading before slow restoration');
  await act(async () => {pendingMe(); await settle();});
  assert.equal(authHarness.currentUser.uid, second.uid, 'Old restored account must not overwrite a new login');
  assert.equal(authHarness.loading, false);
  console.log('PASS: no draft reservation, five-minute customer countdown/expiry/renewal, cookie-only profile edit, checkout privacy and stale responses.');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  await unlink(output);
}

