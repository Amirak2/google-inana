// Regenerates the home-screen and browser icons from the gold logo.
// Run after the logo changes: node scripts/make-icons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const logo = 'public/inana-logo-gold.png';
const background = '#050A14';

// The logo sits on the site's night-sky colour: iOS paints transparent icons black,
// and the padding keeps the circle clear of the rounded mask.
async function icon(size, scale = 0.86) {
  const inner = Math.round(size * scale);
  const mark = await sharp(logo).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } }).composite([{ input: mark, gravity: 'centre' }]).png({ compressionLevel: 9 }).toBuffer();
}

await writeFile('public/apple-touch-icon.png', await icon(180));
await writeFile('public/icon-192.png', await icon(192));
await writeFile('public/icon-512.png', await icon(512));
// Android masks icons more tightly, so the maskable variant gets extra padding.
await writeFile('public/icon-maskable-512.png', await icon(512, 0.68));
await writeFile('public/favicon-32.png', await icon(32, 1));

// favicon.ico: a single 48px PNG wrapped in an ICO container.
const png = await icon(48, 1);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(48, 6); header.writeUInt8(48, 7);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile('public/favicon.ico', Buffer.concat([header, png]));
console.log('icons written');
