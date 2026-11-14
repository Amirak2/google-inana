import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { resolvePage, renderPage, robotsTxt, sitemapXml, previewImage, SITE_ORIGIN } from '../server/pageMeta.ts';
import { optimizeImage } from '../server/imageOptimizer.ts';

const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const products = [
  { id: 'pearl-a4', title: 'مروارید آزمایشی', description: 'گردنبند مروارید با قفل نقره‌ای.\nطول ۴۵ سانت.', images: ['/products/pearls/a4-1.jpeg', '/media/products/abc'], sku: 'a4',
    category: 'گردنبند مروارید', calculatedPrice: 3_000_000, stock: 2, availableStock: 2, createdAt: '2026-10-24T10:00:00.000Z' },
  { id: 'sold', title: 'آویز "ویژه" <b>', description: '', images: [], calculatedPrice: 0, stock: 0, createdAt: 'not-a-date' },
];

// Known pages keep their own title; private pages are hidden from search engines.
assert.equal(resolvePage('/', products).status, 200);
assert.match(resolvePage('/shop/', products).title, /ویترین زیورآلات/);
assert.equal(resolvePage('/admin', products).noindex, true);
assert.equal(resolvePage('/favorites', products).noindex, true);

// A product link carries the product's own name, text and photo.
const meta = resolvePage('/product/pearl-a4', products);
assert.deepEqual([meta.status, meta.type, meta.title], [200, 'product', 'مروارید آزمایشی | INANA GOLD']);
assert.equal(meta.description, 'گردنبند مروارید با قفل نقره‌ای. طول ۴۵ سانت.');
assert.equal(meta.image, `${SITE_ORIGIN}/products/pearls/a4-1.jpeg?w=960&f=jpg`, 'Preview photo is an absolute JPEG address');
assert.equal(meta.jsonLd.offers.price, 30_000_000, 'Toman is published as rial');
assert.equal(meta.jsonLd.offers.availability, 'https://schema.org/InStock');
assert.equal(previewImage('https://cdn.example/x.png'), 'https://cdn.example/x.png');
const html = renderPage(template, meta);
assert.match(html, /<title>مروارید آزمایشی \| INANA GOLD<\/title>/);
assert.match(html, /<meta property="og:image" content="https:\/\/inanagold\.ir\/products\/pearls\/a4-1\.jpeg\?w=960&amp;f=jpg" \/>/);
assert.match(html, /<meta property="og:type" content="product" \/>/);
assert.match(html, /<link rel="canonical" href="https:\/\/inanagold\.ir\/product\/pearl-a4" \/>/);
assert.match(html, /application\/ld\+json/);
assert.equal((html.match(/<title>/g) || []).length, 1);
assert.match(html, /rel="apple-touch-icon"/, 'The shell links the home-screen icon');

// Product text can never break out of the page.
const hostile = renderPage(template, resolvePage('/product/sold', products));
assert.ok(!hostile.includes('<b>') && hostile.includes('آویز &quot;ویژه&quot; &lt;b&gt;'));
assert.ok(!/"offers"/.test(hostile), 'No price is published for a product without one');
const script = renderPage(template, { ...meta, jsonLd: { name: '</script><script>alert(1)</script>' } });
assert.ok(!script.includes('</script><script>alert'));

// Unknown addresses are real 404s, hidden from search engines.
for (const path of ['/nope', '/product/missing', '/product/%E0%A4%A', '/shop/extra']) {
  const missing = resolvePage(path, products);
  assert.deepEqual([missing.status, missing.noindex], [404, true], path);
  assert.match(renderPage(template, missing), /<meta name="robots" content="noindex" \/>/);
}
// If the catalog cannot be read, a product link still opens with the general preview.
assert.equal(resolvePage('/product/pearl-a4', null).status, 200);

assert.match(robotsTxt(), /Disallow: \/admin\n/);
assert.match(robotsTxt(), /Sitemap: https:\/\/inanagold\.ir\/sitemap\.xml/);
const sitemap = sitemapXml(products);
assert.match(sitemap, /<loc>https:\/\/inanagold\.ir\/product\/pearl-a4<\/loc><lastmod>2026-10-24<\/lastmod>/);
assert.match(sitemap, /<loc>https:\/\/inanagold\.ir\/shop<\/loc>/);
assert.ok(!sitemap.includes('/admin') && !sitemap.includes('/favorites') && !sitemap.includes('not-a-date'));

// Preview photos come out as JPEG even from a transparent PNG and without a WebP-capable client.
const png = await sharp({ create: { width: 1400, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const preview = await optimizeImage('test/preview.png', png, 'image/png', '*/*', 960, 'jpeg');
assert.equal(preview.contentType, 'image/jpeg');
const info = await sharp(preview.data).metadata();
assert.deepEqual([info.format, info.width, info.hasAlpha], ['jpeg', 960, false]);
assert.deepEqual((await sharp(preview.data).stats()).channels.map(channel => Math.round(channel.mean)), [255, 255, 255], 'Transparency becomes white, not black');
assert.equal((await optimizeImage('test/preview.png', png, 'image/png', 'image/png', 960)).data, png, 'Ordinary requests are unchanged');

// The home-screen icons exist at the sizes the shell declares.
for (const [file, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  const icon = await sharp(new URL(`../public/${file}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')).metadata();
  assert.deepEqual([icon.width, icon.height], [size, size], file);
}
console.log('PASS: per-page titles and product previews, real 404s, escaped text, robots and sitemap, JPEG preview photos and home-screen icons.');
