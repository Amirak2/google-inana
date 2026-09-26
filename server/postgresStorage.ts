import { Pool, type PoolClient } from 'pg';

let sharedPool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

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

export class PostgresStore {
  private buckets = new Map<string, Map<string, any>>();
  private original = new Map<string, string>();
  private client: PoolClient | null = null;
  private transactionOpen = false;

  static async load(exclusive = false, publicRead = false): Promise<PostgresStore> {
    const store = new PostgresStore();
    const pool = getPool();
    await ensureSchema(pool);

    try {
      if (exclusive) {
        store.client = await pool.connect();
        // BEGIN may fail after reaching the server; clean up even in that case.
        store.transactionOpen = true;
        await store.client.query('BEGIN');
        await store.client.query('SELECT pg_advisory_xact_lock($1)', [20260912]);
      }

      const runner = store.client || pool;
      const result = await runner.query(
        publicRead
          ? "SELECT bucket, record_key, value_json FROM site_records WHERE bucket NOT IN ('orders','idempotency','media','logs','quotes','users','favorites','sessions','otp','phoneOtp','revoked','rateLimits')"
          : 'SELECT bucket, record_key, value_json FROM site_records'
      );
      for (const row of result.rows) {
        // pg already decodes JSONB, including scalar strings.
        const value = row.value_json;
        store.map(row.bucket).set(row.record_key, value);
        store.original.set(JSON.stringify([row.bucket, row.record_key]), JSON.stringify(value));
      }
      store.prune();
      return store;
    } catch (error) {
      await store.release();
      throw error;
    }
  }

  map<T = any>(bucket: string): Map<string, T> {
    if (!this.buckets.has(bucket)) this.buckets.set(bucket, new Map());
    return this.buckets.get(bucket)!;
  }
  get<T = any>(bucket: string, key: string): T | undefined { return this.map<T>(bucket).get(key); }
  set(bucket: string, key: string, value: any): void { this.map(bucket).set(key, value); }
  replaceMap(bucket: string, values: Map<string, any>): void { this.buckets.set(bucket, values); }
  tokenSet(bucket: string) {
    return {
      has: (token: string) => this.map(bucket).has(token),
      add: (token: string) => this.set(bucket, token, { expiresAt: Date.now() + 31 * 86400000 }),
    };
  }
  checkpoint() { return structuredClone(this.buckets); }
  restore(snapshot: Map<string, Map<string, any>>): void {
    this.buckets = structuredClone(snapshot);
  }

  private prune(): void {
    const now = Date.now();
    for (const bucket of ['otp', 'phoneOtp', 'quotes', 'revoked', 'rateLimits']) {
      for (const [key, value] of this.map(bucket)) {
        if ((value.expiresAt ?? value.resetAt ?? Infinity) < now) this.map(bucket).delete(key);
      }
    }
    for (const [key, list] of this.map<any[]>('reservations')) {
      const active = list.filter((item) => item.expiresAt > now);
      if (active.length) this.set('reservations', key, active);
      else this.map('reservations').delete(key);
    }
  }

  async commit(): Promise<void> {
    if (!this.client || !this.transactionOpen) return;
    const currentKeys = new Set<string>();
    for (const [bucket, values] of this.buckets) {
      for (const [key, value] of values) {
        const composite = JSON.stringify([bucket, key]);
        currentKeys.add(composite);
        const serialized = JSON.stringify(value);
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
