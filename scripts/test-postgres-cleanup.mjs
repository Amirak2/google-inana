// Run: node --experimental-strip-types scripts/test-postgres-cleanup.mjs
import assert from 'node:assert/strict';
import pg from 'pg';

process.env.PG_URI = 'postgresql://unused/test';
const originalConnect = pg.Pool.prototype.connect;
const originalQuery = pg.Pool.prototype.query;
const queue = [];
pg.Pool.prototype.connect = async () => {
  const next = queue.shift();
  assert.ok(next, 'Unexpected connection request');
  if (next instanceof Error) throw next;
  return next;
};
pg.Pool.prototype.query = async () => { throw new Error('public read failure'); };

function client(failAt, rollbackFails = false, rows = []) {
  const failure = new Error(`Failure at ${failAt}`);
  return {
    calls: [], releases: [], failure,
    async query(sql) {
      this.calls.push(sql);
      if (sql === 'ROLLBACK' && rollbackFails) throw new Error('Rollback failed');
      if (failAt && sql.includes(failAt)) throw failure;
      return { rows };
    },
    release(discard) { this.releases.push(discard); },
  };
}

try {
  const { PostgresStore } = await import('../server/postgresStorage.ts');
  // Schema failure must preserve the original error and discard an unusable connection.
  const schemaFailure = client('CREATE TABLE', true);
  queue.push(schemaFailure);
  await assert.rejects(PostgresStore.load(true), error => error === schemaFailure.failure);
  assert.deepEqual(schemaFailure.releases, [true]);

  const schema = client();
  const healthy = client();
  queue.push(schema, healthy);
  const store = await PostgresStore.load(true);
  assert.deepEqual(schema.releases, [false]);
  assert.deepEqual(healthy.releases, []);
  await store.commit();
  await store.release();
  await store.release();
  assert.deepEqual(healthy.releases, [false]);
  assert.ok(!healthy.calls.includes('ROLLBACK'));

  for (const stage of ['BEGIN', 'pg_advisory_xact_lock', 'SELECT bucket']) {
    for (const rollbackFails of [false, true]) {
      const failed = client(stage, rollbackFails);
      queue.push(failed);
      await assert.rejects(PostgresStore.load(true), error => error === failed.failure);
      assert.ok(failed.calls.includes('ROLLBACK'), stage);
      assert.deepEqual(failed.releases, [rollbackFails]);
    }
  }

  const malformed = client(null, false, [{ bucket: 'reservations', record_key: 'bad', value_json: null }]);
  queue.push(malformed);
  await assert.rejects(PostgresStore.load(true), TypeError);
  assert.deepEqual(malformed.releases, [false]);
  assert.ok(malformed.calls.includes('ROLLBACK'));

  const aborted = client();
  queue.push(aborted);
  const unfinished = await PostgresStore.load(true);
  await unfinished.release();
  await unfinished.release();
  assert.deepEqual(aborted.releases, [false]);
  assert.equal(aborted.calls.filter(sql => sql === 'ROLLBACK').length, 1);

  queue.push(new Error('Pool unavailable'));
  await assert.rejects(PostgresStore.load(true), /Pool unavailable/);
  await assert.rejects(PostgresStore.load(false, true), /public read failure/);
  assert.equal(queue.length, 0);
  console.log('PASS: schema, BEGIN, lock, read, decode/prune, rollback failure, successful commit, double release and pool failures');
} finally {
  pg.Pool.prototype.connect = originalConnect;
  pg.Pool.prototype.query = originalQuery;
}
