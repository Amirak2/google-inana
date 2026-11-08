import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { imageWidth, optimizeImage } from '../server/imageOptimizer.ts';

assert.equal(imageWidth(undefined), 1600);
assert.equal(imageWidth('300'), 480);
assert.equal(imageWidth('480'), 480);
assert.equal(imageWidth('700'), 960);
assert.equal(imageWidth('99999'), 1600);
assert.equal(imageWidth('junk'), 1600);

// A noisy 2400px PNG stands in for an uncompressed product upload.
const width = 2400, height = 1800;
const raw = randomBytes(width * height * 3);
const png = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();

const card = await optimizeImage('test/photo.png', png, 'image/png', 'image/avif,image/webp,*/*', 480);
assert.equal(card.contentType, 'image/webp');
assert.ok(card.data.length < png.length / 5, 'card image should be much smaller than the upload');
assert.equal((await sharp(card.data).metadata()).width, 480);
assert.equal(await optimizeImage('test/photo.png', png, 'image/png', 'image/webp', 480), card, 'repeat requests are cached');

const full = await optimizeImage('test/photo.png', png, 'image/png', 'image/webp');
assert.equal((await sharp(full.data).metadata()).width, 1600);

// Browsers without WebP, GIFs and unreadable files get the original bytes.
assert.equal((await optimizeImage('test/photo.png', png, 'image/png', 'image/png,*/*', 480)).data, png);
const gif = Buffer.from('GIF89a');
assert.equal((await optimizeImage('test/a.gif', gif, 'image/gif', 'image/webp')).data, gif);
const broken = Buffer.from('not an image');
assert.deepEqual(await optimizeImage('test/broken.png', broken, 'image/png', 'image/webp'), { data: broken, contentType: 'image/png' });

console.log('PASS: product photos resize to WebP by width, cache, and fall back to originals.');
