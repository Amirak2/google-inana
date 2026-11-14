import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApp } from './server';
import type { Store } from './server/storage';
import { PostgresStore, PostgresConflictError } from './server/postgresStorage';
import { getMediaObject, putMediaObject } from './server/objectStorage';
import { imageWidth, optimizeImage } from './server/imageOptimizer';
import { configureTrustedProxy, normalizeClientIp } from './server/clientIp';
import { runPostgresRequest } from './server/postgresRequest';
import { securityHeaders } from './server/securityHeaders';
import { renderPage, resolvePage, robotsTxt, sitemapXml } from './server/pageMeta';
import { startGoldScheduler } from './server/goldScheduler';
import { startSmsScheduler } from './server/smsOutbox';
import { PEARL_PRODUCTS, PEARL_GOLD_PRODUCTS, LETTER_PRODUCTS, SEA_PRODUCTS, UNCOLLECTED_GOLD_PRODUCTS } from './src/data/seedData';

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
configureTrustedProxy(app, process.env.TRUSTED_PROXY_CIDRS);
// One address for the site: www goes to the bare domain, so search engines see no duplicate.
app.use((req, res, next) => {
  if (req.hostname?.startsWith('www.') && ['GET', 'HEAD'].includes(req.method)) {
    res.redirect(301, `https://${req.hostname.slice(4)}${req.originalUrl}`);
    return;
  }
  next();
});
app.use(express.raw({ type: '*/*', limit: '4mb' }));
const previewFormat = (value: unknown) => (value === 'jpg' ? 'jpeg' as const : undefined);

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
      const image = media.public
        ? await optimizeImage(id, data, media.contentType, req.get('accept'), imageWidth(req.query.w), previewFormat(req.query.f))
        : { data, contentType: media.contentType };
      res.set('Content-Type', image.contentType);
      res.set('Cache-Control', media.public ? 'public, max-age=86400' : 'private, no-store');
      if (media.public) res.set('Vary', 'Accept');
      res.set('X-Content-Type-Options', 'nosniff');
      res.send(image.data);
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
const productMediaPaths = new Set([...PEARL_PRODUCTS, ...PEARL_GOLD_PRODUCTS, ...LETTER_PRODUCTS, ...SEA_PRODUCTS, ...UNCOLLECTED_GOLD_PRODUCTS].flatMap(product => product.images)
  .filter(url => /^\/products\/(pearls|letters|sea|catalog)\/[\w.-]+$/.test(url)));
app.get(['/products/pearls/:filename', '/products/letters/:filename', '/products/sea/:filename', '/products/catalog/:filename'], async (req, res) => {
  if (!productMediaPaths.has(req.path)) {
    res.sendStatus(404); return;
  }
  try {
    let data = await getMediaObject(req.path.slice(1));
    // Stage this catalog addition into the existing private bucket on first access.
    // Subsequent requests and deployments keep using the stored object.
    if (!data && /^(?:(a3blcwh|a4|ashki-20261024|avizorange|meshkikhelal|medusa-20261024|deforange|p9-20261024|defmeshki)-[123]|avizheart-[234]|p9-model-20261027)\.jpeg$/.test(req.params.filename)) {
      const staged = await readFile(path.join(currentDir, 'product-media', 'pearls', req.params.filename));
      await putMediaObject(req.path.slice(1), staged, 'image/jpeg');
      data = await getMediaObject(req.path.slice(1));
      if (!data?.equals(staged)) throw new Error('Product photo upload verification failed');
    }
    if (!data) { res.sendStatus(404); return; }
    const contentType = req.params.filename.endsWith('.webp') ? 'image/webp' : req.params.filename.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
    const image = await optimizeImage(req.path, data, contentType, req.get('accept'), imageWidth(req.query.w), previewFormat(req.query.f));
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Vary', 'Accept');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(image.data);
  } catch {
    res.sendStatus(503);
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(currentDir, 'client');

// The public catalog as the API returns it (with today's prices), kept for a minute so
// page views, previews and the sitemap do not each read the database.
let catalogCache: { at: number; products: any[] } | null = null;
async function publicCatalog(): Promise<any[] | null> {
  if (catalogCache && Date.now() - catalogCache.at < 60_000) return catalogCache.products;
  try {
    const request = new Request('http://internal/api/products');
    const response = await runPostgresRequest('GET', '/api/products', { ...process.env, NODE_ENV: 'production' },
      (snapshot, requestEnv) => createApp(snapshot, requestEnv).fetch(request.clone(), { clientIp: 'internal' }));
    const body = await response.json();
    const products = Array.isArray(body) ? body : body.products;
    if (!response.ok || !Array.isArray(products)) throw new Error('Catalog unavailable');
    catalogCache = { at: Date.now(), products };
    return products;
  } catch (error) {
    console.error('Catalog for page previews failed', error);
    return catalogCache?.products || null;
  }
}

app.get('/robots.txt', (_req, res) => { res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(robotsTxt()); });
app.get('/sitemap.xml', async (_req, res) => {
  const products = await publicCatalog();
  if (!products) { res.sendStatus(503); return; }
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml(products));
});

app.use(express.static(clientDir, { maxAge: '1d', index: false }));
// Missing files answer 404 instead of the app shell.
app.get(/^(?!\/product\/).*\.[a-z0-9]{2,5}$/i, (_req, res) => { res.sendStatus(404); });

// Every page address gets the app shell with its own title, description and picture,
// which is what link previews and search engines read. Unknown addresses answer 404.
let pageTemplate: string | null = null;
app.get('*', async (req, res) => {
  try {
    pageTemplate ??= await readFile(path.join(clientDir, 'index.html'), 'utf8');
    const meta = resolvePage(req.path, req.path.startsWith('/product/') ? await publicCatalog() : null);
    res.status(meta.status).type('text/html').set('Cache-Control', 'no-cache').send(renderPage(pageTemplate, meta));
  } catch (error) {
    console.error('Page render failed', error);
    res.sendFile(path.join(clientDir, 'index.html'));
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`INANA GOLD listening on port ${port}`));
startGoldScheduler(process.env);
startSmsScheduler(process.env);
