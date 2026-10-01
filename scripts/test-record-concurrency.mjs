import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore, PostgresConflictError } from '../server/postgresStorage.ts';
import { runPostgresRequest, requestBuckets } from '../server/postgresRequest.ts';
process.env.PG_URI = 'postgresql://unused/test';
const db = installFakePostgres();
const deps = { externalize: async () => new Map(), migrate: async () => {} };
try {
  const attempts = Array(8).fill(0);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let arrivals = 0;
  const results = await Promise.all(attempts.map((_, i) => runPostgresRequest('POST', '/api/test/independent', {}, async store => {
    attempts[i]++;
    assert.equal(store.get('settings', `independent-${i}`), undefined);
    if (++arrivals === 8) release();
    await gate;
    store.set('settings', `independent-${i}`, { value: i });
    return Response.json({ success: true }, { status: 201 });
  }, deps)));
  assert.ok(results.every(response => response.status === 201));
  assert.deepEqual(attempts, Array(8).fill(1), 'unrelated records must not force a retry');
  for (let i = 0; i < 8; i++) assert.deepEqual(db.get('settings', `independent-${i}`), { value: i });
  const a = await PostgresStore.load(true), b = await PostgresStore.load(true);
  a.get('settings', 'watched'); b.set('settings', 'watched', true);
  await b.commit(); await b.release();
  a.set('settings', 'dependent-decision', true);
  await assert.rejects(a.commit(), PostgresConflictError);
  await a.release();
  assert.equal(db.get('settings', 'dependent-decision'), undefined);
  assert.ok(!requestBuckets('/api/auth/profile').includes('orders'));
  assert.ok(!requestBuckets('/api/auth/profile').includes('quotes'));
  const scoped = await PostgresStore.load(false, false, ['settings']);
  assert.equal(scoped.map('users').size, 0);
  await scoped.release();
  console.log('PASS: 8/8 independent writes committed on the first attempt; dependent absence rejects stale writes; snapshots omit unrelated buckets. Simulated PostgreSQL, not a production capacity benchmark.');
} finally { db.restore(); }
