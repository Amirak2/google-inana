import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { Store } from '../server/storage.ts';
import { createAccounting } from '../server/accounting.ts';
import { emptyCosts } from '../src/utils/accounting.ts';
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
const fixture = new Store({}); for (const [index, product] of INITIAL_PRODUCTS.slice(0, 2).entries()) fixture.set('products', product.id, index === 0 ? { ...product, pricingMode: 'fixed', weight: 0 } : product);
let data = createAccounting(fixture).snapshot(); let failed = true; const mutations = []; let syncs = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (url.endsWith('/sync-site')) { syncs++; return Response.json({ success: true, result: { count: 0 } }); }
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
  assert.ok(syncs >= 1, 'Mount automatically synchronizes existing site orders');
  await update(() => button('محصولات سایت').click());
  assert.match(document.body.textContent, new RegExp(INITIAL_PRODUCTS[0].title));
  assert.equal(buttons().filter(element => element.textContent.trim() === 'ثبت خرید / قیمت موجودی').length, 2, 'Existing site products appear without registering purchases');
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
  await update(() => button('خرید / موجودی اولیه').click());
  const goldSelect = document.querySelector('[role="dialog"] select');
  await update(() => { goldSelect.value = INITIAL_PRODUCTS[1].id; goldSelect.dispatchEvent(new window.Event('change', { bubbles: true })); });
  const weight = await input('وزن طلای هر قطعه — گرم', '۰٫۸۴۰');
  assert.equal(weight.inputMode, 'decimal');
  await input('اجرت بنکدار — درصد', '۱۶٫۵');
  assert.match(document.querySelector('[role="dialog"]').textContent, /۰.۹۷۸۶ گرم/);
  assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /اصل طلای خریداری‌شده/);
  await input('خرید مروارید — تومان برای هر عدد', '۲۰۰۰۰۰');
  await input('ساخت محصول آماده — تومان برای هر عدد', '۵۰۰۰۰');
  await update(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.deepEqual(mutations.at(-1).body.goldPurchase, { weight: 0.84, makingPercent: 16.5 });
  assert.deepEqual(mutations.at(-1).body.costs, { ...emptyCosts(), pearl: 200000, assembly: 50000 }, 'Gold purchase retains independent cash components');
  await update(() => button('فروش اینستاگرام').click());
  const saleSelect = document.querySelector('[role="dialog"] select');
  await update(() => { saleSelect.value = INITIAL_PRODUCTS[1].id; saleSelect.dispatchEvent(new window.Event('change', { bubbles: true })); });
  await input('نام مشتری', 'آزمایش درصدها');
  await input('قیمت نهایی فروش هر عدد پس از تخفیف — تومان', '۱۰۰۰۰');
  await input('اجرت فروش — درصد', '۱۶٫۵');
  await input('سود فروش — درصد', '۷');
  await input('تخفیف بخش طلا — درصد', '۰');
  await update(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.deepEqual(mutations.at(-1).body.items[0].goldSale, { makingPercent: 16.5, profitPercent: 7, discountPercent: 0 });
  assert.equal(mutations.at(-1).body.items[0].goldRevenueGrams, undefined);
  await update(() => button('فروش اینستاگرام').click());
  await update(() => button('افزودن کالا').click());
  assert.equal(document.querySelectorAll('select').length, 4, 'Two product rows, exchange selector and channel selector');
  await update(() => button('بستن فرم حسابداری')?.click());
  // Real Escape handling closes the modal and restores a usable page.
  await update(() => window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  const now = new Date().toISOString();
  const assemblyOrder = { id: 'ui-assembly', trackingCode: 'UI-ASSEMBLY', customerName: 'ساخت آزمایشی', status: 'تأیید شده', createdAt: now,
    totalPrice: 1000000, items: [{ productId: INITIAL_PRODUCTS[0].id, productTitle: 'کالا', weight: 0, quantity: 1, unitPrice: 1000000, totalPrice: 1000000 }] };
  createAccounting(fixture).syncOrder(assemblyOrder);
  data = createAccounting(fixture).snapshot();
  await update(() => button('تازه‌سازی').click());
  await update(() => button('فروش‌ها').click());
  await update(() => button('ثبت / مشاهدهٔ هزینه‌ها').click());
  await input('ساخت بعد از سفارش — تومان برای هر عدد (اگر قبلاً در خرید منظور نشده)', '۱۰۰۰۰۰');
  const paidCheckbox = [...document.querySelectorAll('label')].find(label => label.textContent.includes('هزینهٔ ساخت پرداخت شده است')).querySelector('input');
  await update(() => paidCheckbox.click());
  await input('تاریخ واقعی پرداخت ساخت — شمسی', '۱۴۰۵/۰۷/۱۳');
  await update(() => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(mutations.at(-1).body.items[0].extraAssembly, 100000);
  assert.equal(mutations.at(-1).body.items[0].extraAssemblyPaid, true);
  assert.equal(mutations.at(-1).body.items[0].extraAssemblyDate, '۱۴۰۵/۰۷/۱۳');
  fixture.map('accountingSales').delete(assemblyOrder.id);
  fixture.map('orders').delete(assemblyOrder.id);
  const refunded = { id: 'ui-refunded', trackingCode: 'UI-REFUND', customerName: 'بازپرداخت آزمایشی', status: 'تأیید شده', createdAt: now,
    totalPrice: 500, items: [{ productId: INITIAL_PRODUCTS[0].id, productTitle: 'کالا', weight: 0, quantity: 1, unitPrice: 500, totalPrice: 500 }] };
  createAccounting(fixture).syncOrder(refunded);
  fixture.set('accountingMoney', 'ui-payment', { id: 'ui-payment', saleId: refunded.id, kind: 'receipt', amount: 500, fee: 0,
    method: 'card_to_card', reference: 'UI-PAY', note: 'آزمایش', occurredAt: now, actor: 'test' });
  fixture.set('accountingReturns', 'ui-return', { id: 'ui-return', saleId: refunded.id, amount: 500, shippingRefund: 0, items: [], restock: false,
    reference: 'UI-RETURN', note: 'آزمایش', occurredAt: now, actor: 'test' });
  data = createAccounting(fixture).snapshot();
  await update(() => button('تازه‌سازی').click());
  await update(() => button('فروش‌ها').click());
  assert.equal(button('تکمیل فروش پس از تحویل').disabled, true, 'Refunded undelivered order cannot be completed from the UI');
  const afterRefundRefresh = mutations.length;
  await update(() => button('تکمیل فروش پس از تحویل').click());
  assert.equal(mutations.length, afterRefundRefresh, 'Disabled completion sends no mutation');
  const requestsBeforeCustomer = mutations.length;
  globalThis.accountingUser = { isAdmin: false, currentUser: { uid: 'customer' } };
  await update(() => root.render(React.createElement(Harness)));
  assert.equal(document.querySelector('[aria-label="حسابداری خصوصی ادمین"]'), null);
  assert.equal(mutations.length, requestsBeforeCustomer);
  console.log('PASS: real accounting React UI, StrictMode fetch completion, Persian numeric inputs, failure draft retention, stable payment keys, purchase form, multi-item Instagram sale and customer access gate.');
} finally { await update(() => root.unmount()); globalThis.fetch = originalFetch; await unlink(output).catch(() => {}); dom.window.close(); }
