import type { D1Database, D1PreparedStatement, R2Bucket, Fetcher } from '@cloudflare/workers-types';
export interface Bindings {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: { fetch(request: Request): Promise<Response> };
  SESSION_SECRET: string;
  [key: string]: any;
}

/** A request-local snapshot, backed by individual D1 rows. The revision guard
 * and changed rows commit in one atomic batch before releasing the response.
 * No auto-replay: a request may have sent an external SMS. */
export class Store {
  private buckets = new Map<string, Map<string, any>>();
  private original = new Map<string, string>();
  private revision = 0;
  private lease = '';
  constructor(private env: Bindings) {}
  static async load(env: Bindings, exclusive = false) {
    const store = new Store(env);
    await env.DB.prepare('INSERT OR IGNORE INTO site_revision (id, revision, lease_until, lease_token) VALUES (1, 0, 0, ?)').bind('').run();
    if (exclusive) {
      store.lease = crypto.randomUUID();
      const result = await env.DB.prepare('UPDATE site_revision SET lease_until = ?, lease_token = ? WHERE id = 1 AND lease_until < ?').bind(Date.now() + 60000, store.lease, Date.now()).run();
      if (!result.meta.changes) throw new BusyError();
    }
    try {
      const [version, records] = await env.DB.batch([
        env.DB.prepare('SELECT revision FROM site_revision WHERE id = 1'),
        env.DB.prepare('SELECT bucket, record_key, value_json FROM site_records'),
      ]);
      store.revision = Number((version.results[0] as any).revision);
      for (const row of records.results as any[]) {
        store.map(row.bucket).set(row.record_key, JSON.parse(row.value_json));
        store.original.set(JSON.stringify([row.bucket, row.record_key]), row.value_json);
      }
      store.prune();
      return store;
    } catch (error) { await store.release(); throw error; }
  }
  map<T = any>(bucket: string): Map<string, T> {
    if (!this.buckets.has(bucket)) this.buckets.set(bucket, new Map());
    return this.buckets.get(bucket)!;
  }
  get<T = any>(bucket: string, key: string): T | undefined { return this.map<T>(bucket).get(key); }
  set(bucket: string, key: string, value: any) { this.map(bucket).set(key, value); }
  replaceMap(bucket: string, values: Map<string, any>) { this.buckets.set(bucket, values); }
  tokenSet(bucket: string) {
    return { has: (token: string) => this.map(bucket).has(token), add: (token: string) => this.set(bucket, token, { expiresAt: Date.now() + 31 * 86400000 }) };
  }
  checkpoint() { return structuredClone(this.buckets); }
  restore(snapshot: Map<string, Map<string, any>>) {
    for (const [bucket, values] of this.buckets) { values.clear(); for (const [k,v] of snapshot.get(bucket) || []) values.set(k,v); }
    for (const [bucket, values] of snapshot) if (!this.buckets.has(bucket)) this.buckets.set(bucket, values);
  }
  private prune() {
    const now = Date.now();
    for (const bucket of ['otp', 'phoneOtp', 'quotes', 'revoked', 'rateLimits']) {
      for (const [key, value] of this.map(bucket)) if ((value.expiresAt ?? value.resetAt ?? Infinity) < now) this.map(bucket).delete(key);
    }
    for (const [key, list] of this.map('reservations')) {
      const active = list.filter((r: any) => r.expiresAt > now);
      if (active.length) this.set('reservations', key, active); else this.map('reservations').delete(key);
    }
  }
  async commit() {
    const changed: D1PreparedStatement[] = [];
    const keys = new Set<string>();
    for (const [bucket, values] of this.buckets) for (const [key, value] of values) {
      const composite = JSON.stringify([bucket, key]); keys.add(composite);
      const json = JSON.stringify(value);
      if (json === this.original.get(composite)) continue;
      if (new TextEncoder().encode(json).length > 900000) throw new Error('Record exceeds safe D1 size');
      changed.push(this.env.DB.prepare('INSERT INTO site_records (bucket, record_key, value_json) VALUES (?, ?, ?) ON CONFLICT(bucket, record_key) DO UPDATE SET value_json = excluded.value_json').bind(bucket, key, json));
    }
    for (const key of this.original.keys()) if (!keys.has(key)) {
      const [bucket, recordKey] = JSON.parse(key);
      changed.push(this.env.DB.prepare('DELETE FROM site_records WHERE bucket = ? AND record_key = ?').bind(bucket, recordKey));
    }
    if (!changed.length) return;
    // A stale revision violates NOT NULL and rolls back the entire D1 batch.
    const guard = this.env.DB.prepare('UPDATE site_revision SET revision = CASE WHEN revision = ? AND (lease_token = ? OR lease_until < ?) THEN revision + 1 ELSE NULL END WHERE id = 1').bind(this.revision, this.lease, Date.now());
    try { await this.env.DB.batch([guard, ...changed]); }
    catch (error) { if (String(error).includes('NOT NULL')) throw new BusyError(); throw error; }
  }
  async release() {
    if (this.lease) await this.env.DB.prepare('UPDATE site_revision SET lease_until = 0, lease_token = ? WHERE id = 1 AND lease_token = ?').bind('', this.lease).run();
  }
}
export class BusyError extends Error {
  constructor() { super('اطلاعات فروشگاه هم‌زمان تغییر کرد. لطفاً دوباره تلاش کنید.'); }
}
