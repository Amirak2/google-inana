import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const { build } = await import(process.platform === 'win32' ? 'esbuild-wasm' : 'esbuild');
const output = new URL('../node_modules/.cache/notifications-ui.mjs', import.meta.url);
await mkdir(new URL('./', output), { recursive: true });
const bundle = await build({
  stdin: { contents: `import React from 'react'; import { NotificationsProvider,useNotifications } from './src/context/NotificationsContext'; import { NotificationCenter } from './src/components/NotificationCenter'; function Probe(){globalThis.notificationHarness=useNotifications();return <><button onClick={globalThis.notificationHarness.openNotifications}>باز کردن اعلان‌ها</button><NotificationCenter/></>;} export function Harness(){return <NotificationsProvider><Probe/></NotificationsProvider>;}`, loader: 'tsx', resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  plugins: [{ name: 'notifications-auth-fixture', setup(api) {
    api.onResolve({ filter: /AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export function useAuth(){return {currentUser:globalThis.fixtureUser,openAuthModal(){}};}` }));
  } }],
});
await writeFile(output, bundle.outputFiles[0].contents);
const dom = new JSDOM('<div id="app"></div>', { url: 'https://local.test/', pretendToBeVisual: true });
for (const name of ['window','document','HTMLElement','Event','KeyboardEvent']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fixtureUser = { uid: 'buyer-a' };
const item = { id: 'n1', userId: 'buyer-a', type: 'order', title: 'سفارش شما تأیید شد', message: 'تأیید سفارش شما انجام شد. ارسال سفارش‌ها روز دوشنبه انجام می‌شود.', createdAt: new Date().toISOString(), orderId: 'o1', trackingCode: 'INA-TEST', status: 'تأیید شده' };
let feed = { notifications: [item], unreadCount: 1, total: 1, orders: [{ id:'o1', trackingCode:'INA-TEST', status:'تأیید شده', totalPrice:12345, createdAt:item.createdAt }] };
let failRead = false, delayed = null;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (options.method === 'POST') {
    if (failRead) return Response.json({ error: 'خواندن ثبت نشد؛ دوباره تلاش کنید.' }, { status: 503 });
    feed = { ...feed, notifications: feed.notifications.map(n => ({ ...n, readAt: item.createdAt })), unreadCount: 0 };
  } else if (delayed) return new Promise(resolve => { delayed.resolve = resolve; });
  return Response.json(feed);
};
const { createRoot } = await import('react-dom/client');
const React = await import('react');
const { act } = React;
const { Harness } = await import(output.href);
const root = createRoot(document.getElementById('app'));
const click = async text => { const button = [...document.querySelectorAll('button')].find(b => b.textContent === text || b.getAttribute('aria-label') === text); assert.ok(button, text); await act(async () => button.click()); };
try {
  await act(async () => root.render(React.createElement(Harness)));
  assert.equal(globalThis.notificationHarness.feed.unreadCount, 1);
  await click('باز کردن اعلان‌ها');
  assert.ok(document.querySelector('[role="dialog"]'));
  assert.match(document.body.textContent, /دوشنبه/);
  assert.equal(document.activeElement.getAttribute('aria-label'), 'بستن اعلان‌ها');
  failRead = true;
  await click('خواندم');
  assert.match(document.querySelector('[role="alert"]').textContent, /خواندن ثبت نشد/);
  assert.equal(globalThis.notificationHarness.feed.unreadCount, 1, 'Failed mutation must not silently mark read');
  failRead = false;
  await click('خواندن همهٔ اعلان‌ها');
  assert.equal(globalThis.notificationHarness.feed.unreadCount, 0);
  await click('سفارش‌های من');
  assert.match(document.body.textContent, /INA-TEST/);
  assert.match(document.body.textContent, /تأیید شده/);
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.activeElement.textContent, 'باز کردن اعلان‌ها');
  // A late reply from account A cannot populate account B's inbox.
  delayed = {};
  let pending;
  await act(async () => { pending = globalThis.notificationHarness.refresh(); });
  const reply = delayed.resolve;
  delayed = null;
  globalThis.fixtureUser = { uid: 'buyer-b' };
  feed = { notifications: [], unreadCount: 0, total: 0, orders: [] };
  await act(async () => root.render(React.createElement(Harness)));
  await act(async () => { reply(Response.json({ notifications:[item],unreadCount:1,total:1,orders:[] })); await pending; });
  assert.equal(globalThis.notificationHarness.feed.total, 0);
  await click('باز کردن اعلان‌ها');
  assert.match(document.body.textContent, /هنوز اعلانی ندارید/);
  globalThis.fixtureUser = null;
  await act(async () => root.render(React.createElement(Harness)));
  assert.equal(document.querySelector('[role="dialog"]'), null, 'Logout closes and clears inbox');
  assert.equal(globalThis.notificationHarness.feed.total, 0);
  console.log('PASS: real notification UI, read/all-read handling, visible errors, order status/Monday copy, focus/Escape and account-switch race isolation.');
} finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; dom.window.close(); await unlink(output); }
