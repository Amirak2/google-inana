import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { Store } from '../server/storage.ts';
import { createAccounting } from '../server/accounting.ts';
import { INITIAL_PRODUCTS } from '../src/data/seedData.ts';

const { build } = await import(process.platform === 'win32' ? 'esbuild-wasm' : 'esbuild');
const output = new URL('../node_modules/.cache/accounting-ui.mjs', import.meta.url);
await mkdir(new URL('./', output), { recursive: true });
const bundle = await build({ stdin: { contents: `import React from 'react'; import {AccountingDashboard} from './src/components/AccountingDashboard'; export function Harness(){return <React.StrictMode><AccountingDashboard/></React.StrictMode>;}`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  plugins: [{ name: 'accounting-fixtures', setup(api) {
    api.onResolve({ filter: /AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    api.onResolve({ filter: /GoldStoreContext$/ }, () => ({ path: 'store', namespace: 'fixture' }));
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'auth' ? 'export function useAuth(){return globalThis.accountingUser;}' : 'export function useGoldStore(){return globalThis.accountingStore;}' }));
  }}] });
await writeFile(output, bundle.outputFiles[0].contents);
const dom = new JSDOM('<div id="app"></div>', { url: 'https://local.test/admin' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement']) Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.accountingUser = { isAdmin: true, currentUser: { uid: 'fixture-admin' } };
globalThis.accountingStore = { products: INITIAL_PRODUCTS.slice(0, 2), refreshProducts: async () => {} };
let data = createAccounting(new Store({})).snapshot(); let failed = true; const mutations = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (!options.method || options.method === 'GET') return Response.json(data);
  const body = JSON.parse(options.body); mutations.push({ url, body });
  if (failed) return Response.json({ error: 'خطای ثبت آزمایشی' }, { status: 409 });
  if (url.endsWith('/settings')) data = { ...data, revision: data.revision + 1, settings: { packaging: body.packaging, assembly: body.assembly } };
  return Response.json({ success: true, result: {} });
};
const React = await import('react'); const { act } = React; const { createRoot } = await import('react-dom/client'); const { Harness } = await import(output.href);
const root = createRoot(document.getElementById('app'));
const settle = () => new Promise(resolve => setTimeout(resolve, 25));
const update = async fn => act(async () => { await fn(); await settle(); });
const buttons = () => [...document.querySelectorAll('button')];
const button = label => buttons().find(element => element.textContent.trim() === label);
async function input(label, value) {
  const field = [...document.querySelectorAll('label')].find(labelElement => labelElement.querySelector('span')?.textContent === label)?.querySelector('input');
  assert.ok(field, `Missing field: ${label}`);
  await update(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, value); field.dispatchEvent(new window.Event('input', { bubbles: true })); });
  return field;
}
try {
  await update(() => root.render(React.createElement(Harness)));
  assert.match(document.body.textContent, /حسابداری و سود اینانا/);
  await update(() => button('هزینه‌های پیش‌فرض').click());
  const field = await input('هزینهٔ بسته‌بندی هر سفارش — تومان', '۱۲۳۴');
  await input('هزینهٔ ساخت هر گردنبند مروارید — تومان', '۵۰۰');
  await update(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.match(document.body.textContent, /خطای ثبت آزمایشی/); assert.equal(field.value, '1234', 'Failed mutation must keep the draft');
  failed = false;
  await update(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(document.querySelector('[role="dialog"]'), null); assert.equal(data.settings.packaging, 1234);
  assert.equal(mutations[0].body.actionId, mutations[1].body.actionId, 'Same draft retry keeps its idempotency key');
  await update(() => button('خرید / موجودی اولیه').click());
  const quantityInput = await input('تعداد قطعه', '2');
  await input('خرید مروارید — تومان برای هر عدد', '۹۰۰۰');
  await update(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  const purchase = mutations.at(-1); assert.ok(purchase.url.endsWith('/purchase')); assert.equal(purchase.body.costs.pearl, 9000); assert.equal(purchase.body.kind, 'opening');
  await update(() => button('فروش اینستاگرام').click());
  await update(() => button('افزودن کالا').click());
  assert.equal(document.querySelectorAll('select').length, 4, 'Two product rows, exchange selector and channel selector');
  await update(() => button('بستن فرم حسابداری')?.click());
  // Real Escape handling closes the modal and restores a usable page.
  await update(() => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  const requestsBeforeCustomer = mutations.length;
  globalThis.accountingUser = { isAdmin: false, currentUser: { uid: 'customer' } };
  await update(() => root.render(React.createElement(Harness)));
  assert.equal(document.querySelector('[aria-label="حسابداری خصوصی ادمین"]'), null);
  assert.equal(mutations.length, requestsBeforeCustomer);
  console.log('PASS: real accounting React UI, StrictMode fetch completion, Persian numeric inputs, failure draft retention, stable payment keys, purchase form, multi-item Instagram sale and customer access gate.');
} finally { await update(() => root.unmount()); globalThis.fetch = originalFetch; await unlink(output).catch(() => {}); dom.window.close(); }
