import { Readable } from 'node:stream';

type ObjectStorageConfig = {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
};

function getConfig(): ObjectStorageConfig | null {
  const endpoint = process.env.LIARA_ENDPOINT?.trim();
  const bucket = process.env.LIARA_BUCKET_NAME?.trim();
  const accessKey = process.env.LIARA_ACCESS_KEY?.trim();
  const secretKey = process.env.LIARA_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return {
    endpoint: endpoint.startsWith('http') ? endpoint : `https://${endpoint}`,
    bucket,
    accessKey,
    secretKey,
  };
}

let clientPromise: Promise<any> | null = null;

async function getClient(): Promise<{ client: any; commands: any; config: ObjectStorageConfig } | null> {
  const config = getConfig();
  if (!config) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      // @ts-ignore - installed by the production package manager.
      const commands = await import('@aws-sdk/client-s3');
      const client = new commands.S3Client({
        region: 'default',
        endpoint: config.endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKey,
          secretAccessKey: config.secretKey,
        },
      });
      return { client, commands };
    })();
  }
  const { client, commands } = await clientPromise;
  return { client, commands, config };
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(getConfig());
}

export async function putMediaObject(key: string, data: Buffer, contentType: string): Promise<void> {
  const storage = await getClient();
  if (!storage) throw new Error('Object Storage is not configured');
  await storage.client.send(new storage.commands.PutObjectCommand({
    Bucket: storage.config.bucket,
    Key: key,
    Body: data,
    ContentType: contentType,
    CacheControl: key.startsWith('products/') ? 'public, max-age=31536000, immutable' : 'private, no-store',
  }));
}

export async function getMediaObject(key: string): Promise<Buffer | null> {
  const storage = await getClient();
  if (!storage) return null;
  try {
    const result = await storage.client.send(new storage.commands.GetObjectCommand({
      Bucket: storage.config.bucket,
      Key: key,
    }));
    if (!result.Body) return null;
    if (typeof result.Body.transformToByteArray === 'function') {
      return Buffer.from(await result.Body.transformToByteArray());
    }
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as Readable) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}
