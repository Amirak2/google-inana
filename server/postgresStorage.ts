import { Pool, type PoolClient } from 'pg';
import { ACCOUNTING_BUCKETS } from './accounting';

let sharedPool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

// JSONB normalizes object key order. Compare content, not JS insertion order.
function serializeRecord(value: any): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

async function releaseClient(client: PoolClient, rollback: boolean): Promise<void> {
  let discard = false;
  try {
    if (rollback) await client.query('ROLLBACK');
  } catch {
    // Never reuse a connection whose transaction state cannot be cleared.
    discard = true;
  } finally {
    client.release(discard);
  }
}

function getPool(): Pool {
  const connectionString = process.env.PG_URI || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('PG_URI or DATABASE_URL is required');
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 10),
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }
  return sharedPool;
}

async function ensureSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await pool.connect();
      let committed = false;
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [20260911]);
        await client.query(`
          CREATE TABLE IF NOT EXISTS site_records (
            bucket TEXT NOT NULL,
            record_key TEXT NOT NULL,
            value_json JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (bucket, record_key)
          )
        `);
        await client.query('COMMIT');
        committed = true;
      } finally {
        await releaseClient(client, !committed);
      }
    })();
  }

  try {
    await schemaReady;
  } catch (error) {
    schemaReady = null;
    throw error;
  }
}

/** Track point reads, including absence; scanning a snapshot does not claim unrelated rows. */
class RecordMap<T> extends Map<string, T> {
  constructor(private observe: (key: string) => void, entries?: Iterable<readonly [string, T]>) { super(entries); }
  get(key: string): T | undefined { this.observe(key); return super.get(key); }
  has(key: string): boolean { this.observe(key); return super.has(key); }
}

export class PostgresStore {
  private buckets = new Map<string, Map<string, any>>();
  private original = new Map<string, string>();
  private reads = new Set<string>();
  private client: PoolClient | null = null;
  private transactionOpen = false;
  private writable = false;
  private publicRead = false;
  private scopeBuckets?: readonly string[];

  private selectQuery(): string {
    const clauses: string[] = [];
    if (this.scopeBuckets) clauses.push('bucket = ANY($1::text[])');
    if (this.publicRead) clauses.push("bucket NOT IN ('orders','idempotency','media','logs','quotes','users','favorites','sessions','otp','phoneOtp','revoked','rateLimits','phoneClaims','quoteOwners','trackingCodes')");
    if (this.publicRead) clauses.push(`bucket NOT IN (${ACCOUNTING_BUCKETS.map(bucket => `'${bucket}'`).join(',')})`);
    return 'SELECT bucket, record_key, value_json FROM site_records' + (clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '');
  }

  static async load(writable = false, publicRead = false, scopeBuckets?: readonly string[]): Promise<PostgresStore> {
    const store = new PostgresStore();
    store.writable = writable;
    store.publicRead = publicRead;
    store.scopeBuckets = scopeBuckets;
    const pool = getPool();
    await ensureSchema(pool);

    try {
      // Request-local snapshot. No connection or database lock is held while
      // handlers call price providers or upload media.
      const result = await pool.query(store.selectQuery(), scopeBuckets ? [scopeBuckets] : []);
      for (const row of result.rows) {
        // pg already decodes JSONB, including scalar strings.
        const value = row.value_json;
        store.map(row.bucket).set(row.record_key, value);
        store.original.set(JSON.stringify([row.bucket, row.record_key]), serializeRecord(value));
      }
      store.prune();
      return store;
    } catch (error) {
      await store.release();
      throw error;
    }
  }

  map<T = any>(bucket: string): Map<string, T> {
    if (!this.buckets.has(bucket)) this.buckets.set(bucket, new RecordMap(key => this.reads.add(JSON.stringify([bucket, key]))));
    return this.buckets.get(bucket)!;
  }
  get<T = any>(bucket: string, key: string): T | undefined { return this.map<T>(bucket).get(key); }
  set(bucket: string, key: string, value: any): void { this.map(bucket).set(key, value); }
  replaceMap(bucket: string, values: Map<string, any>): void { this.buckets.set(bucket, new RecordMap(key => this.reads.add(JSON.stringify([bucket, key])), values)); }
  tokenSet(bucket: string) {
    return {
      has: (token: string) => this.map(bucket).has(token),
      add: (token: string) => this.set(bucket, token, { expiresAt: Date.now() + 31 * 86400000 }),
    };
  }
  checkpoint() { return structuredClone(this.buckets); }
  restore(snapshot: Map<string, Map<string, any>>): void {
    this.buckets.clear();
    for (const [bucket, values] of snapshot) this.replaceMap(bucket, structuredClone(values));
  }

  private prune(): void {
    const now = Date.now();
    for (const bucket of ['otp', 'phoneOtp', 'quotes', 'revoked', 'rateLimits']) {
      for (const [key, value] of this.map(bucket)) {
        if ((bucket === 'quotes' ? (value.retainUntil ?? value.expiresAt + 86400000) : (value.expiresAt ?? value.resetAt ?? Infinity)) < now) this.map(bucket).delete(key);
      }
    }
    for (const [key, list] of this.map<any[]>('reservations')) {
      const active = list.filter((item) => item.expiresAt > now);
      if (active.length) this.set('reservations', key, active);
      else this.map('reservations').delete(key);
    }
  }

  async commit(): Promise<void> {
    if (!this.writable) return;
    const current = new Map<string, string>();
    for (const [bucket, values] of this.buckets) {
      for (const [key, value] of values) current.set(JSON.stringify([bucket, key]), serializeRecord(value));
    }
    if (current.size === this.original.size && [...current].every(([key, value]) => this.original.get(key) === value)) return;
    this.client = await getPool().connect();
    this.transactionOpen = true;
    await this.client.query('BEGIN');
    await this.client.query("SET LOCAL lock_timeout = '3s'");
    await this.client.query("SET LOCAL statement_timeout = '5s'");
    await this.client.query('SELECT pg_advisory_xact_lock($1)', [20260912]);
    // Validate only rows that informed this decision or will be changed.
    // The short commit lock also protects absent keys against concurrent inserts.
    const dependencies = new Set(this.reads);
    for (const key of new Set([...current.keys(), ...this.original.keys()])) {
      if (current.get(key) !== this.original.get(key)) dependencies.add(key);
    }
    const requested = [...dependencies].map(key => { const [bucket, record_key] = JSON.parse(key); return { bucket, record_key }; });
    const fresh = await this.client.query(
      `SELECT bucket, record_key, value_json FROM site_records
       WHERE (bucket, record_key) IN (SELECT bucket, record_key FROM jsonb_to_recordset($1::jsonb) AS requested(bucket text, record_key text))`,
      [JSON.stringify(requested)]
    );
    const freshValues = new Map<string, string>(fresh.rows.map(row => [JSON.stringify([row.bucket, row.record_key]), serializeRecord(row.value_json)]));
    if ([...dependencies].some(key => freshValues.get(key) !== this.original.get(key))) throw new PostgresConflictError();
    const currentKeys = new Set<string>();
    for (const [bucket, values] of this.buckets) {
      for (const [key, value] of values) {
        const composite = JSON.stringify([bucket, key]);
        currentKeys.add(composite);
        const serialized = serializeRecord(value);
        if (serialized === this.original.get(composite)) continue;
        await this.client.query(
          `INSERT INTO site_records (bucket, record_key, value_json, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (bucket, record_key)
           DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()`,
          [bucket, key, serialized]
        );
      }
    }
    for (const composite of this.original.keys()) {
      if (currentKeys.has(composite)) continue;
      const [bucket, key] = JSON.parse(composite);
      await this.client.query('DELETE FROM site_records WHERE bucket = $1 AND record_key = $2', [bucket, key]);
    }
    await this.client.query('COMMIT');
    this.transactionOpen = false;
  }

  async release(): Promise<void> {
    const client = this.client;
    if (!client) return;
    const rollback = this.transactionOpen;
    this.client = null;
    this.transactionOpen = false;
    await releaseClient(client, rollback);
  }
}

export class PostgresConflictError extends Error {
  constructor() { super('اطلاعات هم‌زمان تغییر کرده است. لطفاً دوباره تلاش کنید.'); }
}
