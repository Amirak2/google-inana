import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { INITIAL_COLLECTIONS, INITIAL_PRODUCTS, RETIRED_COLLECTION_NAMES } from '../src/data/seedData.ts';
const remaining = ['INANA SEA', 'INANA PEARL GOLD', 'INANA PEARLS', 'INANA LETTERS'];
assert.deepEqual(INITIAL_COLLECTIONS.map(c => c.name), remaining);
assert.ok(INITIAL_PRODUCTS.every(p => !RETIRED_COLLECTION_NAMES.includes(p.collection)));
const env = { NODE_ENV: 'test', SESSION_SECRET: 'isolated-collection-retirement-secret-longer-than-32' };
const store = new Store(env);
store.set('migrations', 'initialProducts', true);
const originals = RETIRED_COLLECTION_NAMES.map((collection, index) => ({ ...INITIAL_PRODUCTS[0],
  id: `legacy-collection-${index}`, collection, stock: index, fixedPrice: 5_000_000 + index,
  images: [`/media/original-${index}`] }));
for (const product of originals) store.set('products', product.id, structuredClone(product));
createApp(store, env);
for (const product of originals) assert.deepEqual(store.get('products', product.id), { ...product, collection: '' });
const response = await createApp(store, env).fetch(new Request('http://local.test/api/collections'));
assert.equal(response.status, 200);
assert.deepEqual((await response.json()).map(c => c.name), remaining);
store.set('products', originals[0].id, { ...originals[0], collection: 'INANA SEA', stock: 8 });
createApp(store, env);
assert.equal(store.get('products', originals[0].id).collection, 'INANA SEA');
assert.equal(store.get('products', originals[0].id).stock, 8);
console.log('PASS: five collections retired in seeds and API, original products/photos/prices/inventory preserved, and later edits retained.');
