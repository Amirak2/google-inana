import assert from 'node:assert/strict';
import { NAVIGATION_KEY, PAGE_TABS, readNavigationState, readAdminTab, saveSessionValue } from '../src/utils/navigationState.ts';
import { DEFAULT_CATALOG_FILTERS } from '../src/utils/catalogFilters.ts';

const values = new Map();
globalThis.sessionStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};
for (const activeTab of PAGE_TABS) {
  const expected = { ...DEFAULT_CATALOG_FILTERS, activeTab, selectedCategory: 'necklace', selectedCollection: 'pearls', searchQuery: 'p9', maxWeight: 12, onlyInStock: true, sortBy: 'weight-desc', quickViewProductId: 'pearl-p9', isCartOpen: true };
  saveSessionValue(NAVIGATION_KEY, expected);
  assert.deepEqual(readNavigationState(), expected);
}
saveSessionValue('inana_admin_tab_admin-one', 'orders');
assert.equal(readAdminTab('admin-one'), 'orders');
assert.equal(readAdminTab('admin-two'), 'direct-pricing');
values.set(NAVIGATION_KEY, '{invalid-json');
assert.equal(readNavigationState().activeTab, 'home');
saveSessionValue(NAVIGATION_KEY, { activeTab: 'unknown', isCartOpen: 'true' });
assert.equal(readNavigationState().activeTab, 'home');
assert.equal(readNavigationState().isCartOpen, false);
globalThis.sessionStorage = {
  getItem: () => { throw new Error('Storage disabled'); },
  setItem: () => { throw new Error('Storage disabled'); },
};
assert.doesNotThrow(() => saveSessionValue(NAVIGATION_KEY, {}));
assert.equal(readNavigationState().activeTab, 'home');
console.log('PASS: page restoration, shop context, account-scoped admin tabs, and invalid/disabled storage.');
