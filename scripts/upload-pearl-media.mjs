import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, GetBucketPolicyCommand, GetBucketAclCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const bucket = process.env.LIARA_BUCKET_NAME;
if (!bucket || !process.env.LIARA_ENDPOINT || !process.env.LIARA_ACCESS_KEY || !process.env.LIARA_SECRET_KEY) throw new Error('Storage configuration is incomplete');
const client = new S3Client({ endpoint: process.env.LIARA_ENDPOINT, region: 'default', forcePathStyle: true, credentials: { accessKeyId: process.env.LIARA_ACCESS_KEY, secretAccessKey: process.env.LIARA_SECRET_KEY } });

if (process.argv.includes('--inspect')) {
  for (const [name, command] of [
    ['policy', new GetBucketPolicyCommand({Bucket: bucket})],
    ['acl', new GetBucketAclCommand({Bucket: bucket})],
    ['objects', new ListObjectsV2Command({Bucket: bucket, MaxKeys: 1000})],
  ]) {
    try {
      const result = await client.send(command);
      if (name === 'policy') console.log('Policy:', result.Policy);
      if (name === 'acl') console.log('ACL grants:', JSON.stringify(result.Grants));
      if (name === 'objects') console.log('Objects:', result.KeyCount, 'Truncated:', !!result.IsTruncated);
    } catch (error) { console.log(name, error.name, error.$metadata?.httpStatusCode); }
  }
} else {
  for (const sku of ['p3', 'class10', 'p9']) {
    if (!process.env.PEARL_MEDIA_DIR) throw new Error('Set PEARL_MEDIA_DIR to the directory containing original product images');
    const data = await readFile(path.join(process.env.PEARL_MEDIA_DIR, `${sku}-white.png`));
    const key = `products/pearls/${sku}-white.png`;
    await client.send(new PutObjectCommand({Bucket: bucket, Key: key, Body: data, ContentType:'image/png', CacheControl:'public, max-age=31536000, immutable'}));
    const stored = await client.send(new GetObjectCommand({Bucket: bucket, Key:key}));
    const retrieved = Buffer.from(await stored.Body.transformToByteArray());
    if (!retrieved.equals(data)) throw new Error(`Upload verification failed for ${sku}`);
    console.log(`Verified ${sku}: ${data.length} bytes`);
  }
}
client.destroy();
