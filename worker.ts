import { env as runtimeEnv } from 'cloudflare:workers';
import { createApp } from './server';
import { Store, BusyError, type Bindings } from './server/storage';

async function externalizeImages(store: Store, bindings: Bindings) {
  const replacements = new Map<string,string>();
  for (const bucket of ['products', 'orders', 'idempotency']) {
    async function visit(value: any, owner: string): Promise<any> {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        if (replacements.has(value)) return replacements.get(value);
        const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
        if (!match) throw new Error('Unsupported image');
        const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
        if (bytes.length > 3 * 1024 * 1024) throw new Error('Image exceeds size limit');
        const id = crypto.randomUUID();
        const publicImage = bucket === 'products';
        const path = `${publicImage ? '/media/products/' : '/api/receipts/'}${id}`;
        await bindings.BUCKET.put(id, bytes, { httpMetadata: { contentType: match[1] } });
        store.set('media', id, { owner, public: publicImage, contentType: match[1] });
        replacements.set(value, path);
        return path;
      }
      if (Array.isArray(value)) return Promise.all(value.map(v => visit(v, owner)));
      if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) value[key] = await visit(value[key], owner);
      }
      return value;
    }
    for (const [key, value] of store.map(bucket)) store.set(bucket, key, await visit(value, value.userId || ''));
  }
  return replacements;
}

export default {
  async fetch(request: Request, suppliedEnv: Bindings): Promise<Response> {
    const bindings = (suppliedEnv || runtimeEnv) as Bindings;
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/media/')) {
      if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      let response = await bindings.ASSETS.fetch(request);
      if (response.status === 404 && !url.pathname.split('/').pop()?.includes('.')) response = await bindings.ASSETS.fetch(new Request(new URL('/index.html', url), request));
      return response;
    }
    let store: Store | undefined;
    try {
      if (!['GET','HEAD'].includes(request.method)) {
        const origin = request.headers.get('origin');
        if (origin && origin !== url.origin) return Response.json({ error: 'مبدأ درخواست معتبر نیست.' }, { status: 403 });
      }
      const publicRead = ['GET','HEAD'].includes(request.method) &&
        ['/api/products', '/api/collections', '/api/settings', '/api/gold-price', '/api/gold-history'].includes(url.pathname);
      store = await Store.load(bindings, !['GET','HEAD'].includes(request.method), publicRead);
      const app = createApp(store, { ...bindings, NODE_ENV: 'production' });
      if (url.pathname.startsWith('/api/receipts/') || url.pathname.startsWith('/media/products/')) {
        const id = url.pathname.split('/').pop()!;
        const metadata = store.get('media', id);
        if (!metadata) return new Response('Not found', { status: 404 });
        if (!metadata.public) {
          const cookie = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('token='))?.slice(6);
          const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || (cookie ? decodeURIComponent(cookie) : '');
          const user = app.authenticate(token);
          if (!user || (user.role !== 'admin' && user.uid !== metadata.owner)) return new Response('Forbidden', { status: 403 });
        }
        const object = await bindings.BUCKET.get(id);
        if (!object) return new Response('Not found', { status: 404 });
        return new Response(request.method === 'HEAD' ? null : object.body, { headers: { 'Content-Type': metadata.contentType, 'Cache-Control': metadata.public ? 'public, max-age=86400' : 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
      }
      let response = await app.fetch(request);
      const replacements = await externalizeImages(store, bindings);
      // Never return success or a session cookie before durable commit.
      try { await store.commit(); }
      catch (error) {
        // A read can return its consistent snapshot if a concurrent write wins.
        // Only its optional cache/pruning write is discarded in this case.
        if (!(error instanceof BusyError) || !['GET','HEAD'].includes(request.method)) throw error;
      }
      if (replacements.size) {
        let body = await response.text();
        for (const [before, after] of replacements) body = body.split(JSON.stringify(before)).join(JSON.stringify(after));
        response = new Response(body, response);
      }
      return response;
    } catch (error) {
      console.error('Request failed', error instanceof Error ? error.message : 'unknown');
      const busy = error instanceof BusyError;
      return Response.json({ error: busy ? error.message : 'ذخیره یا دریافت اطلاعات انجام نشد. لطفاً دوباره تلاش کنید.' }, { status: busy ? 409 : 503, headers: { 'Cache-Control': 'no-store', ...(busy ? { 'Retry-After': '2' } : {}) } });
    } finally {
      if (store) try { await store.release(); } catch { console.error('Could not release request lease'); }
    }
  },
};
