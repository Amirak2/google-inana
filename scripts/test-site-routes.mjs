import assert from 'node:assert/strict';
import { PAGE_PATHS, buildSiteRoute, parseSiteRoute, productPath } from '../src/utils/siteRoutes.ts';

for (const [tab, path] of Object.entries(PAGE_PATHS)) {
  const route = parseSiteRoute(path);
  assert.equal(route.activeTab, tab);
  assert.equal(buildSiteRoute(route), path);
  assert.deepEqual(parseSiteRoute(`${path === '/' ? '' : path}/`), route);
}
const filtered = { activeTab: 'shop', selectedCategory: 'گردنبند', selectedCollection: 'مروارید', searchQuery: 'p9 & کلاسیک', quickViewProductId: null };
const filteredUrl = new URL(buildSiteRoute(filtered), 'https://inanagold.ir');
assert.deepEqual(parseSiteRoute(filteredUrl.pathname, filteredUrl.search), filtered);
for (const id of ['pearl-p9', 'کد محصول', 'part/one?#']) {
  assert.equal(parseSiteRoute(productPath(id)).quickViewProductId, id);
  assert.equal(parseSiteRoute(productPath(id)).activeTab, 'shop');
}
const fromHome = { ...filtered, activeTab: 'home', quickViewProductId: 'pearl-p9' };
const productUrl = new URL(buildSiteRoute(fromHome), 'https://inanagold.ir');
assert.deepEqual(parseSiteRoute(productUrl.pathname, productUrl.search), fromHome);
assert.equal(parseSiteRoute('/product/pearl-p9', '?page=unknown').activeTab, 'shop');
assert.equal(parseSiteRoute('/product/%broken').quickViewProductId, null);
assert.equal(parseSiteRoute('/about').searchQuery, '');
assert.equal(parseSiteRoute('/unknown').activeTab, 'home');
console.log('PASS: independent pages/products, encoded IDs, filters, direct links, trailing slashes and malformed URLs.');
