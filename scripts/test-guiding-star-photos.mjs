import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { GUIDING_STAR_PRODUCT_ID, GUIDING_STAR_PHOTOS } from '../src/data/seedData.ts';

const env = { NODE_ENV: 'test', SESSION_SECRET: 'isolated-guiding-star-photo-test-secret-longer-than-32' };
assert.equal(GUIDING_STAR_PHOTOS.length, 7);
for (const photo of GUIDING_STAR_PHOTOS) await access(new URL(`../product-media/pearls/${photo.split('/').at(-1)}`, import.meta.url));
const route = await readFile(new URL('../liara-server.ts', import.meta.url), 'utf8');
assert.ok(route.includes('setare-rahnama-20261116-[1-7]'), 'The photos are staged into storage on first request');
assert.ok(route.includes('.concat(GUIDING_STAR_PHOTOS)'), 'The photo addresses are allowed by the product photo route');

// The live product was created in the admin panel with two temporary links.
const store = new Store(env);
store.set('products', GUIDING_STAR_PRODUCT_ID, { id: GUIDING_STAR_PRODUCT_ID, title: 'ستاره راهنما', stock: 2, weight: 1.2, images: ['https://example.test/temporary-1.webp', 'https://example.test/temporary-2.webp'] });
createApp(store, env);
const updated = store.get('products', GUIDING_STAR_PRODUCT_ID);
assert.deepEqual(updated.images, GUIDING_STAR_PHOTOS);
assert.deepEqual([updated.title, updated.stock, updated.weight], ['ستاره راهنما', 2, 1.2]);

// Runs once: a later gallery edit in the admin panel is kept.
store.set('products', GUIDING_STAR_PRODUCT_ID, { ...updated, images: ['/media/products/admin-photo'] });
createApp(store, env);
assert.deepEqual(store.get('products', GUIDING_STAR_PRODUCT_ID).images, ['/media/products/admin-photo']);

// A catalog without this product does not gain it.
const fresh = new Store(env);
createApp(fresh, env);
assert.equal(fresh.get('products', GUIDING_STAR_PRODUCT_ID), undefined);
console.log('PASS: "ستاره راهنما" gets its seven photos once, old photos removed, other fields and later edits kept.');
