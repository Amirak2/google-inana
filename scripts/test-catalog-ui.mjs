import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { INITIAL_PRODUCTS, INITIAL_COLLECTIONS } from '../src/data/seedData.ts';
import { DEFAULT_SETTINGS } from '../src/utils/pricingEngine.ts';

// Exercise real provider, catalog, navigation and collection entry points.
// Product cards are lightweight markers; APIs are fixtures with no live writes.
const { build } = await import(process.platform === 'win32' ? 'esbuild-wasm' : 'esbuild');
const output = new URL('../node_modules/.cache/catalog-ui.mjs', import.meta.url);
await mkdir(new URL('./', output), {recursive: true});
const bundle = await build({
  stdin: {contents: `
    import React from 'react';
    import { GoldStoreProvider, useGoldStore } from './src/context/GoldStoreContext';
    import { ShopCatalog } from './src/components/ShopCatalog';
    import { Navbar } from './src/components/Navbar';
    import { CollectionsShowcase } from './src/components/CollectionsShowcase';
    function Probe() { globalThis.catalogHarness = useGoldStore(); return <><Navbar/><ShopCatalog/><CollectionsShowcase/></>; }
    export function Harness() { return <GoldStoreProvider><Probe/></GoldStoreProvider>; }
  `, resolveDir: process.cwd(), loader: 'tsx'},
  bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false,
  plugins: [{name: 'catalog-fixtures', setup(api) {
    api.onResolve({filter: /AuthContext$/}, () => ({path: 'auth', namespace: 'fixture'}));
    api.onResolve({filter: /ProductCard$/}, () => ({path: 'card', namespace: 'fixture'}));
    api.onLoad({filter: /.*/, namespace: 'fixture'}, ({path}) => ({loader: 'tsx', resolveDir: process.cwd(), contents: path === 'auth'
      ? `export function useAuth() { return {currentUser: null, userProfile: null, loading: false, isAdmin: false, openAuthModal() {}, logout() {}}; }`
      : `import React from 'react'; export function ProductCard({product}) { return <article data-product-id={product.id}>{product.title}</article>; }`}));
  }}],
});
await writeFile(output, bundle.outputFiles[0].contents);
const dom = new JSDOM('<div id="app"></div>', {url: 'https://local.test/shop'});
for (const name of ['window', 'document', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement']) {
  Object.defineProperty(globalThis, name, {configurable: true, value: dom.window[name]});
}
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: dom.window.navigator});
window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let products = structuredClone(INITIAL_PRODUCTS.filter(product => product.letter || product.pricingMode === 'fixed'));
products = products.map(product => ({...product, availableStock: product.letter === 'F' ? 0 : 1}));
const originalFetch = globalThis.fetch;
globalThis.fetch = async url => {
  if (url === '/api/products') return Response.json(products);
  if (url === '/api/collections') return Response.json(INITIAL_COLLECTIONS);
  if (url === '/api/settings') return Response.json(DEFAULT_SETTINGS);
  if (url === '/api/gold-price') return Response.json({pricePerGram: 23932462, changePercent: 0, status: 'manual'});
  throw new Error(`Unexpected request: ${url}`);
};
const React = await import('react');
const {act} = React;
const {createRoot} = await import('react-dom/client');
const {Harness} = await import(output.href);
const root = createRoot(document.getElementById('app'));
const settle = () => new Promise(resolve => setTimeout(resolve, 40));
const catalog = () => document.getElementById('shop-catalog-section');
const ids = () => [...catalog().querySelectorAll('[data-product-id]')].map(node => node.dataset.productId);
const category = name => [...catalog().querySelectorAll('button')].find(button => button.textContent.trim().startsWith(`${name} (`));
async function click(node) {assert.ok(node); await act(async () => {node.click(); await settle();});}
async function update(operation) {await act(async () => {operation(); await settle();});}
try {
  await act(async () => {root.render(React.createElement(Harness)); await settle();});
  assert.equal(ids().length, 13);
  await click(category('حروف انگلیسی'));
  await click([...catalog().querySelectorAll('button')].find(button => button.textContent.trim() === 'A'));
  assert.equal(ids().length, 1);
  const shopLink = [...document.querySelectorAll('a')].find(link => link.textContent.trim() === 'ویترین طلا');
  await click(shopLink);
  assert.equal(catalogHarness.selectedLetter, null);
  assert.equal(catalogHarness.selectedCategory, null);
  assert.equal(ids().length, 13, 'Navbar reset must include the former local letter filter');

  const pearlTile = [...document.querySelectorAll('#collections-showcase-section h3')]
    .find(node => node.textContent.includes('کالکشن مروارید')).closest('.group');
  await click(pearlTile);
  assert.equal(ids().length, 9);
  assert.equal(category('حروف انگلیسی').textContent.trim(), 'حروف انگلیسی (۰)');
  const removePearls = catalog().querySelector('button[aria-label="حذف کالکشن مروارید"]');
  assert.ok(removePearls, 'Selected collection must be visible and removable');
  await click(category('حروف انگلیسی'));
  assert.equal(ids().length, 0);
  await click(removePearls);
  assert.equal(ids().length, 4);
  assert.equal(category('حروف انگلیسی').textContent.trim(), 'حروف انگلیسی (۴)');

  await update(() => catalogHarness.openCatalog());
  const range = catalog().querySelector('input[type="range"]');
  assert.equal(Number(range.min), 0.26);
  assert.equal(Number(range.max), 0.38);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(range, '0.3');
    range.dispatchEvent(new window.Event('input', {bubbles: true}));
    range.dispatchEvent(new window.Event('change', {bubbles: true}));
    await settle();
  });
  assert.equal(catalogHarness.maxWeight, 0.3);
  assert.equal(ids().length, 11, 'A real slider movement must filter sub-0.5g gold');
  const heavy = {...products.find(product => product.letter === 'M'), id: 'local-heavy', title: 'طلای تست ۱۲ گرمی', weight: 12};
  products.push(heavy);
  await act(async () => {await catalogHarness.refreshProducts();});
  assert.equal(ids().includes(heavy.id), false);
  await click([...catalog().querySelectorAll('button')].find(button => button.textContent.includes('حذف همه فیلترها')));
  assert.equal(catalogHarness.maxWeight, null);
  assert.equal(ids().length, 14);
  assert.ok(ids().includes(heavy.id), 'Show all must include the locally added 12g product');
  assert.equal(Number(catalog().querySelector('input[type="range"]').max), 12);
  await update(() => catalogHarness.openCatalog({selectedCategory: 'حروف انگلیسی', maxWeight: 0.001}));
  assert.equal(ids().length, 0);
  await click([...catalog().querySelectorAll('button')].find(button => button.textContent.trim() === 'مشاهده همه محصولات'));
  assert.equal(ids().length, 14, 'Empty-state show-all must also remove the weight ceiling');
  await click(catalog().querySelector('input[type="checkbox"]'));
  assert.equal(ids().length, 13);
  assert.equal(new URL(window.location.href).searchParams.get('inStock'), '1');
  await click(catalog().querySelector('input[type="checkbox"]'));
  const sort = catalog().querySelector('select');
  await act(async () => {
    sort.value = 'weight-desc';
    sort.dispatchEvent(new window.Event('change', {bubbles: true}));
    await settle();
  });
  assert.equal(ids()[0], heavy.id);
  assert.equal(new URL(window.location.href).searchParams.get('sort'), 'weight-desc');

  await update(() => catalogHarness.setSearchQuery('مرواريد'));
  assert.equal(ids().length, 8);
  await update(() => catalogHarness.setSearchQuery('مروارید'));
  assert.equal(ids().length, 8);
  await update(() => catalogHarness.openCatalog({selectedCategory: 'حروف انگلیسی', selectedCollection: 'INANA LETTERS',
    selectedLetter: 'A', maxWeight: 0.3, onlyInStock: true, sortBy: 'price-desc', searchQuery: 'پلاک'}));
  assert.equal(ids().length, 1);
  const sharedUrl = window.location.href;
  const params = new URL(sharedUrl).searchParams;
  assert.equal(params.get('letter'), 'A'); assert.equal(params.get('maxWeight'), '0.3');
  assert.equal(params.get('inStock'), '1'); assert.equal(params.get('sort'), 'price-desc');
  sessionStorage.clear();
  await act(async () => {root.render(React.createElement(Harness, {key: 'refresh'})); await settle();});
  assert.equal(ids().length, 1);
  assert.equal(catalogHarness.selectedLetter, 'A');
  assert.equal(catalogHarness.maxWeight, 0.3);
  assert.equal(catalog().querySelector('input[type="checkbox"]').checked, true);
  assert.equal(catalog().querySelector('select').value, 'price-desc');
  assert.equal(window.location.href, sharedUrl, 'Refresh/shared link restores all controls, independently of stored session state');
  await update(() => catalogHarness.setSortBy('price-asc'));
  await act(async () => {window.history.back(); await settle();});
  assert.equal(catalogHarness.sortBy, 'price-desc', 'Back restores filters from the URL');
  await update(() => catalogHarness.setQuickViewProduct(products.find(product => product.letter === 'A')));
  assert.ok(window.location.pathname.startsWith('/product/'));
  assert.equal(new URL(window.location.href).searchParams.get('letter'), 'A');
  await act(async () => {root.render(React.createElement(Harness, {key: 'product-refresh'})); await settle();});
  assert.equal(catalogHarness.quickViewProduct?.letter, 'A');
  assert.equal(catalogHarness.onlyInStock, true);
  assert.equal(ids().length, 1);
  console.log('PASS: navbar letter reset, visible removable collection and contextual counts, actual small-weight slider, unlimited heavy product, Arabic search, refresh/share/back/product filter restoration.');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
  globalThis.fetch = originalFetch;
  await unlink(output);
}
