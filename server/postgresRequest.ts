import type { Store } from './storage';
import { PostgresStore, PostgresConflictError } from './postgresStorage';
import { externalizeImages, migrateInlineMedia, replaceResponseImages } from './mediaStorage';
import { requestWrites } from './requestPolicy';
import { ACCOUNTING_BUCKETS } from './accounting';

type Sms = { send: () => Promise<void>; mobile: string; code: string };
type Dependencies = {
  load: typeof PostgresStore.load;
  externalize: typeof externalizeImages;
  migrate: typeof migrateInlineMedia;
};

function cachedMarketFetch(): typeof fetch {
  const cache = new Map<string, Promise<Response>>();
  return async (input, init) => {
    const key = JSON.stringify([String(input), init?.method || 'GET', Array.from(new Headers(init?.headers))]);
    if (!cache.has(key)) cache.set(key, globalThis.fetch(input, init));
    return (await cache.get(key)!).clone();
  };
}

async function clearFailedOtp(sms: Sms, load: typeof PostgresStore.load) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const store = await load(true);
    try {
      if (store.get<any>('otp', sms.mobile)?.code === sms.code) store.map('otp').delete(sms.mobile);
      for (const [id, value] of store.map<any>('phoneOtp')) {
        if (value.newMobile === sms.mobile && value.code === sms.code) store.map('phoneOtp').delete(id);
      }
      // Preserve rate-limit counters even if delivery failed.
      await store.commit();
      return;
    } catch (error) {
      if (!(error instanceof PostgresConflictError) || attempt === 3) throw error;
    } finally { await store.release(); }
  }
}

/** Exclude unrelated private datasets from request snapshots. */
export function requestBuckets(pathname: string): string[] {
  const buckets = ['products', 'migrations', 'market', 'settings', 'collections', 'users', 'logs', 'revoked', 'rateLimits', 'media', 'phoneClaims'];
  if (pathname.startsWith('/api/auth/')) buckets.push('otp', 'phoneOtp');
  if (pathname.includes('/favorites')) buckets.push('favorites');
  if (/^\/api\/(orders|cart|products|admin)/.test(pathname)) buckets.push('orders', 'idempotency', 'quotes', 'quoteOwners', 'reservations', 'trackingCodes', 'inventoryHolds');
  if (/^\/api\/(orders|admin)/.test(pathname)) buckets.push(...ACCOUNTING_BUCKETS);
  return buckets;
}

export async function runPostgresRequest(
  method: string, pathname: string, env: Record<string, any>,
  operation: (store: Store, requestEnv: Record<string, any>) => Promise<Response>,
  dependencies: Partial<Dependencies> = {},
): Promise<Response> {
  const load = dependencies.load || PostgresStore.load;
  const externalize = dependencies.externalize || externalizeImages;
  const migrate = dependencies.migrate || migrateInlineMedia;
  const writable = requestWrites(method, pathname);
  const publicRead = !writable && ['/api/collections', '/api/settings'].includes(pathname);
  const marketFetch = cachedMarketFetch();
  for (let attempt = 0; attempt < 4; attempt++) {
    const store = await load(writable, publicRead, requestBuckets(pathname));
    const messages: Sms[] = [];
    try {
      let response = await operation(store as unknown as Store, {
        ...env, marketFetch,
        deferSms: (send: Sms['send'], metadata: Omit<Sms, 'send'>) => messages.push({ send, ...metadata }),
      });
      // All external uploads finish BEFORE acquiring the short database lock.
      const replacements = writable ? await externalize(store) : new Map<string, string>();
      if (writable) await migrate(store);
      await store.commit();
      await store.release();
      for (const sms of messages) {
        try { await sms.send(); }
        catch (error) {
          try { await clearFailedOtp(sms, load); }
          catch { console.error('Failed to clear undelivered OTP'); }
          throw error;
        }
      }
      if (method !== 'HEAD' && replacements.size && response.headers.get('content-type')?.includes('application/json')) {
        const data = replaceResponseImages(await response.json(), replacements);
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        response = new Response(JSON.stringify(data), { status: response.status, headers });
      }
      return response;
    } catch (error) {
      if (!(error instanceof PostgresConflictError) || attempt === 3) throw error;
      // No SMS has been sent on a stale attempt. Read and validate afresh;
      // cached provider GETs and content-addressed uploads are safe to reuse.
    } finally { await store.release(); }
  }
  throw new PostgresConflictError();
}
