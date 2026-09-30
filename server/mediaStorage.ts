import { createHash } from 'node:crypto';
import type { PostgresStore } from './postgresStorage';
import { isObjectStorageConfigured, putMediaObject } from './objectStorage';

type Media = { owner: string; public: boolean; contentType: string; data?: string; objectKey?: string };
type Upload = typeof putMediaObject;

function decodeImage(value: string) {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) throw new Error('Unsupported image');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new Error('Image exceeds size limit');
  return { contentType: match[1], bytes };
}

// Call only inside a database transaction. Upload failure leaves database rows untouched.
export async function externalizeImages(store: Pick<PostgresStore, 'get' | 'set' | 'map'>, upload: Upload = putMediaObject, configured = isObjectStorageConfigured()) {
  const replacements = new Map<string, string>();
  for (const bucket of ['products', 'collections', 'orders', 'idempotency']) {
    async function visit(value: any, owner: string, isPublic: boolean): Promise<any> {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        if (!configured) throw new Error('Object Storage is required for image uploads');
        const { contentType, bytes } = decodeImage(value);
        // Scope private files to their owner, even when two users send identical images.
        const id = createHash('sha256').update(isPublic ? 'products' : `receipts:${owner}`).update(bytes).digest('hex');
        const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
        const objectKey = `${isPublic ? 'products' : 'receipts'}/${id}.${extension}`;
        if (!store.get<Media>('media', id)?.objectKey) {
          await upload(objectKey, bytes, contentType);
          store.set('media', id, { owner: isPublic ? '' : owner, public: isPublic, contentType, objectKey });
        }
        const url = `${isPublic ? '/media/products/' : '/api/receipts/'}${id}`;
        replacements.set(`${isPublic ? 'public' : owner}\0${value}`, url);
        return url;
      }
      if (Array.isArray(value)) return Promise.all(value.map(item => visit(item, owner, isPublic)));
      if (value && typeof value === 'object') {
        owner = value.userId || owner;
        for (const key of Object.keys(value)) {
          const visibility = key === 'paymentReceiptImage' ? false : key === 'productImage' ? true : isPublic;
          value[key] = await visit(value[key], owner, visibility);
        }
      }
      return value;
    }
    for (const [key, value] of store.map(bucket)) store.set(bucket, key, await visit(value, value.userId || '', ['products', 'collections'].includes(bucket)));
  }
  return replacements;
}

export function replaceResponseImages(value: any, replacements: Map<string, string>, owner = ''): any {
  if (typeof value === 'string') return replacements.get(`${owner}\0${value}`) || replacements.get(`public\0${value}`) || value;
  if (Array.isArray(value)) return value.map(item => replaceResponseImages(item, replacements, owner));
  if (value && typeof value === 'object') {
    owner = value.userId || owner;
    return Object.fromEntries(Object.entries(value).map(([key,item]) => [key, replaceResponseImages(item, replacements, key === 'productImage' ? 'public' : owner)]));
  }
  return value;
}

export async function migrateInlineMedia(store: Pick<PostgresStore, 'set' | 'map'>, upload: Upload = putMediaObject) {
  if (!isObjectStorageConfigured()) return;
  // Bound work per request; URLs and ownership remain unchanged during migration.
  let remaining = 5;
  for (const [id, media] of store.map<Media>('media')) {
    if (!media.data || media.objectKey) continue;
    const extension = media.contentType === 'image/jpeg' ? 'jpg' : media.contentType.split('/')[1];
    const objectKey = `${media.public ? 'products' : 'receipts'}/${id}.${extension}`;
    await upload(objectKey, Buffer.from(media.data, 'base64'), media.contentType);
    const { data: _inline, ...metadata } = media;
    store.set('media', id, { ...metadata, objectKey });
    if (--remaining === 0) break;
  }
}
