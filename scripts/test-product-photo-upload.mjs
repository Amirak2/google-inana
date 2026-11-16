import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fitWithin, dataUrlBytes, isUploadedPhoto, PHOTO_MAX_BYTES, PHOTO_MAX_SIDE } from '../src/utils/productPhoto.ts';
import { externalizeImages } from '../server/mediaStorage.ts';

assert.deepEqual(fitWithin(3000, 4000), { width: 1200, height: 1600 }, 'Large photos are scaled down, keeping their shape');
assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 }, 'Small photos are not enlarged');
assert.equal(PHOTO_MAX_SIDE, 1600);
const bytes = Buffer.from('a small stand-in for photo bytes');
const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
assert.equal(dataUrlBytes(dataUrl), bytes.length);
assert.ok(isUploadedPhoto(dataUrl)); assert.ok(!isUploadedPhoto('/products/pearls/a4-1.jpeg'));
// Eight photos at the size cap fit in one save request (4 MB body limit, base64 adds a third).
assert.ok(8 * PHOTO_MAX_BYTES * 4 / 3 < 3.6 * 1024 * 1024);

// On save the server moves a picked photo to storage and keeps a permanent site address.
const buckets = { products: new Map([['p1', { id: 'p1', images: ['/products/pearls/a4-1.jpeg', dataUrl] }]]), media: new Map() };
const store = { get: (bucket, key) => buckets[bucket]?.get(key), set: (bucket, key, value) => { (buckets[bucket] ||= new Map()).set(key, value); }, map: bucket => buckets[bucket] || new Map() };
const uploads = [];
await externalizeImages(store, async (key, data, contentType) => { uploads.push({ key, size: data.length, contentType }); }, true);
const saved = buckets.products.get('p1').images;
assert.equal(saved[0], '/products/pearls/a4-1.jpeg');
assert.match(saved[1], /^\/media\/products\/[0-9a-f]{64}$/);
assert.deepEqual(uploads.map(upload => [upload.size, upload.contentType]), [[bytes.length, 'image/jpeg']]);

const gallery = await readFile(new URL('../src/components/AdminProductGallery.tsx', import.meta.url), 'utf8');
assert.ok(gallery.includes('type="file"') && gallery.includes('انتخاب عکس از دستگاه'), 'The gallery offers picking a photo from the device');
console.log('PASS: a photo picked in the admin gallery is compacted, sent with the product and stored permanently.');
