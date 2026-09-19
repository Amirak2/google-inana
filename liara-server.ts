import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server';
import type { Store } from './server/storage';
import { PostgresStore } from './server/postgresStorage';

const app = express();
app.set('trust proxy', 1);
app.use(express.raw({ type: '*/*', limit: '4mb' }));

function decodeImage(value: string): { contentType: string; data: string } | null {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) return null;
  if (Buffer.byteLength(match[2], 'base64') > 3 * 1024 * 1024) throw new Error('Image exceeds size limit');
  return { contentType: match[1], data: match[2].replace(/\s/g, '') };
}

async function externalizeImages(store: PostgresStore): Promise<Map<string, string>> {
  const replacements = new Map<string, string>();
  for (const bucket of ['products', 'orders', 'idempotency']) {
    async function visit(value: any, owner: string): Promise<any> {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        if (replacements.has(value)) return replacements.get(value)!;
        const image = decodeImage(value);
        if (!image) throw new Error('Unsupported image');
        const id = crypto.randomUUID();
        const isPublic = bucket === 'products';
        const url = `${isPublic ? '/media/products/' : '/api/receipts/'}${id}`;
        store.set('media', id, { owner, public: isPublic, ...image });
        replacements.set(value, url);
        return url;
      }
      if (Array.isArray(value)) return Promise.all(value.map((item) => visit(item, owner)));
      if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) value[key] = await visit(value[key], owner);
      }
      return value;
    }
    for (const [key, value] of store.map(bucket)) store.set(bucket, key, await visit(value, value.userId || ''));
  }
  return replacements;
}

async function handleRequest(req: express.Request, res: express.Response): Promise<void> {
  const write = !['GET', 'HEAD'].includes(req.method);
  const publicRead = !write && ['/api/products', '/api/collections', '/api/settings', '/api/gold-price', '/api/gold-history'].includes(req.path);
  let store: PostgresStore | null = null;
  try {
    store = await PostgresStore.load(write, publicRead);
    const origin = `${req.protocol}://${req.get('host')}`;
    if (write && req.get('origin') && req.get('origin') !== origin) {
      res.status(403).json({ error: 'مبدأ درخواست معتبر نیست.' });
      return;
    }
    const siteApp = createApp(store as unknown as Store, { ...process.env, NODE_ENV: 'production' });

    if (req.path.startsWith('/api/receipts/') || req.path.startsWith('/media/products/')) {
      const id = req.path.split('/').pop()!;
      const media = store.get<any>('media', id);
      if (!media) { res.sendStatus(404); return; }
      if (!media.public) {
        const cookieToken = req.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith('token='))?.slice(6);
        const token = req.get('authorization')?.replace(/^Bearer /, '') || (cookieToken ? decodeURIComponent(cookieToken) : '');
        const user = siteApp.authenticate(token);
        if (!user || (user.role !== 'admin' && user.uid !== media.owner)) { res.sendStatus(403); return; }
      }
      res.set('Content-Type', media.contentType);
      res.set('Cache-Control', media.public ? 'public, max-age=86400' : 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.send(Buffer.from(media.data, 'base64'));
      return;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
      else if (value !== undefined) headers.set(key, value);
    }
    const request = new Request(`${origin}${req.originalUrl}`, {
      method: req.method,
      headers,
      body: write && req.body?.length ? req.body : undefined,
      duplex: write ? 'half' : undefined,
    } as RequestInit & { duplex?: 'half' });
    let response = await siteApp.fetch(request);
    const replacements = await externalizeImages(store);
    await store.commit();
    let body = Buffer.from(await response.arrayBuffer());
    if (replacements.size && response.headers.get('content-type')?.includes('application/json')) {
      let text = body.toString('utf8');
      for (const [before, after] of replacements) text = text.split(JSON.stringify(before)).join(JSON.stringify(after));
      body = Buffer.from(text);
    }
    response.headers.forEach((value, key) => res.set(key, value));
    res.status(response.status).send(body);
  } catch (error) {
    console.error('Request failed', error);
    res.status(503).json({ error: 'ذخیره یا دریافت اطلاعات انجام نشد. لطفاً دوباره تلاش کنید.' });
  } finally {
    await store?.release();
  }
}

app.all(['/api/*', '/media/*'], (req, res) => { void handleRequest(req, res); });

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(currentDir, 'client');
app.use(express.static(clientDir, { maxAge: '1d', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`INANA GOLD listening on port ${port}`));
