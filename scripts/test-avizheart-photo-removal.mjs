import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { PEARL_PRODUCTS } from '../src/data/seedData.ts';

const env = { NODE_ENV: 'test', SESSION_SECRET: 'isolated-avizheart-photo-test-secret-longer-than-32' };
const corrupt = '/products/pearls/avizheart-1.jpeg';
const product = PEARL_PRODUCTS.find(product => product.id === 'pearl-avizheart');
assert.ok(!product.images.includes(corrupt));

// Live stores seeded before the fix still list the corrupt photo first.
const store = new Store(env);
store.set('migrations', 'initialProducts', true);
store.set('migrations', 'pearlAvizheartV1', true);
store.set('products', product.id, { ...product, stock: 0, fixedPrice: 9_000_000, images: [corrupt, ...product.images, '/media/products/admin-photo'] });
createApp(store, env);
const updated = store.get('products', product.id);
assert.deepEqual(updated.images, [...product.images, '/media/products/admin-photo']);
assert.equal(updated.stock, 0);
assert.equal(updated.fixedPrice, 9_000_000);

// Runs once: a later administrator gallery edit is kept.
store.set('products', product.id, { ...updated, images: [corrupt] });
createApp(store, env);
assert.deepEqual(store.get('products', product.id).images, [corrupt]);

const fresh = new Store(env);
createApp(fresh, env);
assert.deepEqual(fresh.get('products', product.id).images, product.images);
console.log('PASS: corrupt Avizheart photo removed once from stored and fresh catalogs, keeping other photos, stock, price and later edits.');
