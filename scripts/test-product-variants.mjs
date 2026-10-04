import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { LETTER_PRODUCTS, INITIAL_COLLECTIONS } from '../src/data/seedData.ts';
import { calculateProductPrice, DEFAULT_SETTINGS } from '../src/utils/pricingEngine.ts';
import { groupCatalogVariants } from '../src/utils/productVariants.ts';
import { filterCatalogProducts, catalogCategoryCounts, DEFAULT_CATALOG_FILTERS } from '../src/utils/catalogFilters.ts';

const options = LETTER_PRODUCTS.filter(p => p.variantGroupId === 'inana-letter-f-weight-options');
assert.deepEqual(options.map(p => p.weight), [0.230, 0.260]);
assert.deepEqual(options.map(p => p.stock), [1, 1]);
assert.equal(new Set(options.map(p => p.id)).size, 2);
for (const product of options) {
  const price = calculateProductPrice(product, 20_000_000, DEFAULT_SETTINGS);
  assert.equal(price.finalPrice, Math.round(20_000_000 * product.weight * 1.165 * 1.07 / 1000) * 1000);
  assert.equal(price.taxAmount, 0);
}
assert.equal(groupCatalogVariants(options).length, 1);
assert.equal(catalogCategoryCounts(options, DEFAULT_CATALOG_FILTERS).get('حروف انگلیسی'), 1);
assert.equal(filterCatalogProducts(options, {...DEFAULT_CATALOG_FILTERS, maxWeight: 0.240})[0].id, options[0].id);
assert.equal(filterCatalogProducts(options, {...DEFAULT_CATALOG_FILTERS, maxWeight: 0.220}).length, 0);
assert.equal(groupCatalogVariants([{...options[0], availableStock: 0}, options[1]])[0].id, options[1].id);

// Real server quote/order paths: each weight is a separate inventory record.
const env = {SESSION_SECRET: 'letter-variants-test-secret-longer-than-32', NODE_ENV: 'test'};
const store = new Store(env);
store.set('market', 'gold', {pricePerGram: 20_000_000, isManualOverride: true});
createApp(store, env);
const auth = createAuthStore(store, env);
const mobile = '09120000731';
store.set('otp', mobile, {code: '12345', attempts: 0, expiresAt: Date.now() + 180000});
const buyer = auth.verifySmsOtpAndAuthenticate(mobile, '12345');
async function request(path, body) {
  const response = await createApp(store, env).fetch(new Request(`http://localhost${path}`, {
    method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${buyer.token}`}, body: JSON.stringify(body),
  }));
  return {status: response.status, body: await response.json()};
}
const require = createRequire(import.meta.url);
const receipt = await require('sharp')({create: {width: 128, height: 128, channels: 3, background: '#eeeeee'}}).png().toBuffer();
const quote = await request('/api/orders/quote', {items: [{productId: options[1].id, quantity: 1}]});
assert.equal(quote.status, 200, JSON.stringify(quote.body));
const order = await request('/api/orders', {
  quoteId: quote.body.quoteId, items: [{productId: options[1].id, quantity: 1}],
  customerName: 'مشتری تست', customerPhone: mobile, customerAddress: 'تهران خیابان آزمایشی پلاک یک',
  paymentReceiptImage: `data:image/png;base64,${receipt.toString('base64')}`,
});
assert.equal(order.status, 201, JSON.stringify(order.body));
assert.equal(order.body.order.items[0].productId, options[1].id);
assert.equal(order.body.order.items[0].weight, 0.260);
assert.equal(store.get('products', options[1].id).stock, 0);
assert.equal(store.get('products', options[0].id).stock, 1);
assert.equal((await request('/api/orders/quote', {items: [{productId: options[1].id, quantity: 1}]})).status, 409);
assert.equal((await request('/api/orders/quote', {items: [{productId: options[0].id, quantity: 1}]})).status, 200);
createApp(store, env);
assert.equal(store.get('products', options[1].id).stock, 0, 'Restart must not restock a sold option');

// Real React provider/card/modal: quick add opens selection, URL and cart track the selected ID.
const {build} = await import(process.platform === 'win32' ? 'esbuild-wasm' : 'esbuild');
const output = new URL('../node_modules/.cache/product-variants-ui.mjs', import.meta.url);
await mkdir(new URL('./', output), {recursive: true});
const bundle = await build({
  stdin: {contents: `import React from 'react'; import {GoldStoreProvider,useGoldStore} from './src/context/GoldStoreContext'; import {ProductCard} from './src/components/ProductCard'; import {ProductDetailModal} from './src/components/ProductDetailModal'; import {groupCatalogVariants} from './src/utils/productVariants'; function Probe(){const s=useGoldStore(); globalThis.variantHarness=s; return <>{groupCatalogVariants(s.products).map(p=><ProductCard key={p.id} product={p}/>)}<ProductDetailModal product={s.quickViewProduct} onClose={()=>s.setQuickViewProduct(null)}/></>;} export function Harness(){return <GoldStoreProvider><Probe/></GoldStoreProvider>;}`, loader: 'tsx', resolveDir: process.cwd()},
  bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  plugins: [{name: 'auth-fixture', setup(api) {
    api.onResolve({filter: /AuthContext$/}, () => ({path: 'auth', namespace: 'fixture'}));
    api.onLoad({filter: /.*/, namespace: 'fixture'}, () => ({loader: 'tsx', contents: `export function useAuth(){return {currentUser:null,userProfile:null,loading:false,isAdmin:false,openAuthModal(){},logout(){}};}`}));
  }}],
});
await writeFile(output, bundle.outputFiles[0].contents);
const dom = new JSDOM('<div id="app"></div>', {url: 'https://local.test/shop'});
for (const name of ['window','document','localStorage','sessionStorage','HTMLElement','HTMLInputElement','HTMLSelectElement','HTMLDialogElement','SVGElement','Element']) Object.defineProperty(globalThis, name, {configurable:true,value:dom.window[name]});
// jsdom does not implement the browser's native dialog top layer.
HTMLDialogElement.prototype.showModal = function () { this.open = true; };
HTMLDialogElement.prototype.close = function () { this.open = false; };
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let products = structuredClone(options).map(p => ({...p, images: [...p.images, '/test-second-photo.webp']}));
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  if (url === '/api/products') return Response.json(products);
  if (url === '/api/collections') return Response.json(INITIAL_COLLECTIONS);
  if (url === '/api/settings') return Response.json(DEFAULT_SETTINGS);
  if (url === '/api/gold-price') return Response.json({pricePerGram:20_000_000,changePercent:0,status:'cached'});
  throw new Error(`Unexpected request: ${url}`);
};
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const {Harness} = await import(output.href);
const root = createRoot(document.getElementById('app'));
const settle = () => new Promise(resolve => setTimeout(resolve, 40));
async function click(selector) {const node=document.querySelector(selector); assert.ok(node, selector); await act(async()=>{node.click();await settle();});}
try {
  await act(async()=>{root.render(React.createElement(Harness));await settle();});
  assert.equal(document.querySelectorAll('[id^="product-card-"]').length, 1);
  await click('button[aria-label="انتخاب وزن آویز طلا حرف F"]');
  assert.equal(variantHarness.cart.length, 0, 'Quick add must require choosing a weight');
  await click('button[aria-label="انتخاب وزن ۲۶۰ سوت"]');
  assert.equal(variantHarness.quickViewProduct.id, options[1].id);
  assert.ok(window.location.pathname.includes(options[1].id));
  const photoTrigger = 'button[aria-label="بزرگ‌نمایی تصویر آویز طلا حرف F"]';
  document.querySelector(photoTrigger).focus();
  document.body.style.overflow = 'auto';
  await click(photoTrigger);
  let viewer = document.querySelector('dialog');
  assert.ok(viewer.open);
  assert.equal(viewer.querySelector('img').getAttribute('src'), options[1].images[0]);
  assert.equal(document.activeElement.getAttribute('aria-label'), 'بستن نمای بزرگ تصویر');
  assert.equal(document.body.style.overflow, 'hidden');
  for (let i = 0; i < 4; i++) await click('button[aria-label="بزرگ‌تر کردن تصویر"]');
  assert.equal(viewer.querySelector('output').textContent, '۳۰۰٪');
  assert.ok(viewer.querySelector('button[aria-label="بزرگ‌تر کردن تصویر"]').disabled);
  for (let i = 0; i < 4; i++) await click('button[aria-label="کوچک‌تر کردن تصویر"]');
  assert.equal(viewer.querySelector('output').textContent, '۱۰۰٪');
  assert.ok(viewer.querySelector('button[aria-label="کوچک‌تر کردن تصویر"]').disabled);
  await act(async()=>{viewer.dispatchEvent(new window.Event('cancel',{cancelable:true})); await settle();});
  assert.equal(document.querySelector('dialog'), null);
  assert.equal(document.body.style.overflow, 'auto');
  assert.ok(document.activeElement === document.querySelector(photoTrigger), 'Focus returns to the photo trigger');
  assert.equal(variantHarness.quickViewProduct.id, options[1].id, 'Closing the photo must preserve product and weight');
  await click('button[aria-label="نمایش تصویر ۲ از آویز طلا حرف F"]');
  await click(photoTrigger);
  viewer = document.querySelector('dialog');
  assert.equal(viewer.querySelector('img').getAttribute('src'), '/test-second-photo.webp');
  assert.equal(viewer.querySelector('output').textContent, '۱۰۰٪');
  await click('button[aria-label="بستن نمای بزرگ تصویر"]');
  assert.equal(document.querySelector('dialog'), null);
  await click('#product-purchase-bar > button');
  assert.equal(variantHarness.cart[0].product.id, options[1].id);
  assert.equal(variantHarness.cart[0].product.weight, 0.260);
  await act(async()=>{variantHarness.setQuickViewProduct(options[0]);await settle();});
  await click('#product-purchase-bar > button');
  assert.deepEqual(variantHarness.cart.map(item=>item.product.id).sort(), options.map(p=>p.id).sort());
  assert.ok(variantHarness.cart.every(item=>item.quantity===1));
  await act(async()=>{variantHarness.addToCart(options[1], 2);await settle();});
  assert.equal(variantHarness.cart.find(item=>item.product.id===options[1].id).quantity, 1);
  products = [{...options[0],availableStock:1},{...options[1],stock:0,availableStock:0}];
  await act(async()=>{await variantHarness.refreshProducts();variantHarness.setQuickViewProduct(options[1]);await settle();});
  assert.equal(document.querySelector('#product-purchase-bar > button').disabled, true);
} finally {
  await act(async()=>{root.unmount();});
  globalThis.fetch = originalFetch;
  dom.window.close();
  await unlink(output);
}
console.log('PASS: single-card weight options, filter/count consistency, selected URL/cart, independent quotes/pricing/stock, sold-option blocking, no reseed on restart. Isolated local data only.');
