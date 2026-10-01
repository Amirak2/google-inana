// Explicit staging tool. Never runs during build or starts a deployment.
// node --import tsx scripts/upload-product-media.mjs --sku gooshware1 --dir <staged-image-directory>
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { PEARL_PRODUCTS } from '../src/data/seedData.ts';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const product = PEARL_PRODUCTS.find(product => product.sku === option('--sku'));
const directory = option('--dir');
if (!product || !directory) throw new Error('Provide an existing product --sku and the directory of its prepared photos with --dir');
const required = ['LIARA_ENDPOINT', 'LIARA_BUCKET_NAME', 'LIARA_ACCESS_KEY', 'LIARA_SECRET_KEY'];
if (required.some(name => !process.env[name])) throw new Error('Liara Object Storage configuration is incomplete');
const client = new S3Client({ endpoint: process.env.LIARA_ENDPOINT, region: 'default', forcePathStyle: true,
  credentials: { accessKeyId: process.env.LIARA_ACCESS_KEY, secretAccessKey: process.env.LIARA_SECRET_KEY } });
try {
  // Read and validate the complete batch before uploading anything.
  const photos = await Promise.all(product.images.map(async url => {
    if (!/^\/products\/pearls\/[a-z0-9-]+\.(png|webp)$/.test(url)) throw new Error('Unsupported product media path');
    const file = path.basename(url), data = await readFile(path.join(directory, file));
    if (!data.length) throw new Error(`Empty photo: ${file}`);
    return { file, key: url.slice(1), data, contentType: file.endsWith('.webp') ? 'image/webp' : 'image/png' };
  }));
  for (const photo of photos) {
    const parameters = { Bucket: process.env.LIARA_BUCKET_NAME, Key: photo.key };
    // Never silently replace an existing immutable image with different bytes.
    let existing = false;
    try { await client.send(new HeadObjectCommand(parameters), { abortSignal: AbortSignal.timeout(20000) }); existing = true; }
    catch (error) { if (error?.$metadata?.httpStatusCode !== 404) throw error; }
    if (!existing) await client.send(new PutObjectCommand({ ...parameters, Body: photo.data,
      ContentType: photo.contentType, CacheControl: 'public, max-age=31536000, immutable' }), { abortSignal: AbortSignal.timeout(20000) });
    const stored = await client.send(new GetObjectCommand(parameters), { abortSignal: AbortSignal.timeout(20000) });
    if (!Buffer.from(await stored.Body.transformToByteArray()).equals(photo.data)) throw new Error(`Stored photo differs: ${photo.file}; choose a new versioned filename`);
    console.log(`Verified ${photo.file}: ${photo.data.length} bytes`);
  }
} finally { client.destroy(); }
