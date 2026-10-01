import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server';
import type { Store } from './server/storage';
import { PostgresStore, PostgresConflictError } from './server/postgresStorage';
import { getMediaObject } from './server/objectStorage';
import { configureTrustedProxy, normalizeClientIp } from './server/clientIp';
import { runPostgresRequest } from './server/postgresRequest';
import { securityHeaders } from './server/securityHeaders';
import { PEARL_PRODUCTS } from './src/data/seedData';

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
configureTrustedProxy(app, process.env.TRUSTED_PROXY_CIDRS);
app.use(express.raw({ type: '*/*', limit: '4mb' }));

async function handleRequest(req: express.Request, res: express.Response): Promise<void> {
  const mutatingMethod = !['GET', 'HEAD'].includes(req.method);
  let store: PostgresStore | null = null;
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    if (mutatingMethod && req.get('origin') && req.get('origin') !== origin) {
      res.status(403).json({ error: 'مبدأ درخواست معتبر نیست.' });
      return;
    }

    if (req.path.startsWith('/api/receipts/') || req.path.startsWith('/media/products/')) {
      store = await PostgresStore.load(false);
      const siteApp = createApp(store as unknown as Store, { ...process.env, NODE_ENV: 'production' });
      const id = req.path.split('/').pop()!;
      const media = store.get<any>('media', id);
      if (!media) { res.sendStatus(404); return; }
      if (!media.public) {
        const cookieToken = req.get('cookie')?.split(';').map((item) => item.trim()).find((item) => item.startsWith('token='))?.slice(6);
        const token = req.get('authorization')?.replace(/^Bearer /, '') || (cookieToken ? decodeURIComponent(cookieToken) : '');
        const user = siteApp.authenticate(token);
        if (!user || (user.role !== 'admin' && user.uid !== media.owner)) { res.sendStatus(403); return; }
      }
      const data = media.objectKey
        ? await getMediaObject(media.objectKey)
        : Buffer.from(media.data, 'base64');
      if (!data) { res.sendStatus(404); return; }
      res.set('Content-Type', media.contentType);
      res.set('Cache-Control', media.public ? 'public, max-age=86400' : 'private, no-store');
      res.set('X-Content-Type-Options', 'nosniff');
      res.send(data);
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
      body: mutatingMethod && req.body?.length ? req.body : undefined,
      duplex: mutatingMethod ? 'half' : undefined,
    } as RequestInit & { duplex?: 'half' });
    const clientIp = normalizeClientIp(req.ip || req.socket.remoteAddress);
    const response = await runPostgresRequest(req.method, req.path, { ...process.env, NODE_ENV: 'production' },
      (snapshot, requestEnv) => createApp(snapshot, requestEnv).fetch(request.clone(), { clientIp }));
    const body = Buffer.from(await response.arrayBuffer());
    response.headers.forEach((value, key) => res.set(key, value));
    res.status(response.status).send(body);
  } catch (error) {
    console.error('Request failed', error);
    const conflict = error instanceof PostgresConflictError;
    if (conflict) res.set('Retry-After', '2');
    res.status(conflict ? 409 : 503).json({ error: conflict ? error.message : 'ذخیره یا دریافت اطلاعات انجام نشد. لطفاً دوباره تلاش کنید.' });
  } finally {
    await store?.release();
  }
}

app.all(['/api/*', '/media/*'], (req, res) => { void handleRequest(req, res); });

// Preserve existing product URLs while serving their bytes from the private bucket.
const pearlMediaFiles = new Set(PEARL_PRODUCTS.flatMap(product => product.images)
  .filter(url => url.startsWith('/products/pearls/'))
  .map(url => url.slice('/products/pearls/'.length)));
app.get('/products/pearls/:filename', async (req, res) => {
  if (!pearlMediaFiles.has(req.params.filename)) {
    res.sendStatus(404); return;
  }
  try {
    const data = await getMediaObject(`products/pearls/${req.params.filename}`);
    if (!data) { res.sendStatus(404); return; }
    res.set('Content-Type', req.params.filename.endsWith('.webp') ? 'image/webp' : 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(data);
  } catch {
    res.sendStatus(503);
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(currentDir, 'client');
app.use(express.static(clientDir, { maxAge: '1d', index: false }));
app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`INANA GOLD listening on port ${port}`));
