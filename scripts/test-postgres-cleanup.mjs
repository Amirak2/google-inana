import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';

process.env.PG_URI = 'postgresql://unused/test';
const db = installFakePostgres();
try {
  const schemaError = db.failNext('CREATE TABLE');
  await assert.rejects(PostgresStore.load(true), value => value === schemaError);
  assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
  const store = await PostgresStore.load(true);
  assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
  store.set('test', 'healthy', true);
  await store.commit(); await store.release(); await store.release();
  assert.equal(db.get('test', 'healthy'), true);
  for (const stage of ['CONNECT', 'BEGIN', 'pg_advisory_xact_lock', 'SELECT bucket', 'INSERT INTO', 'COMMIT']) {
    for (const rollbackFails of [false, true]) {
      const aborted = await PostgresStore.load(true);
      aborted.set('test', stage, true);
      const error = db.failNext(stage);
      if (rollbackFails && stage !== 'CONNECT') db.failNext('ROLLBACK');
      await assert.rejects(aborted.commit(), value => value === error);
      await aborted.release(); await aborted.release();
      assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
    }
  }
  const loadError = db.failNext('SELECT bucket');
  await assert.rejects(PostgresStore.load(false, true), value => value === loadError);
  db.set('reservations', 'invalid', null);
  await assert.rejects(PostgresStore.load(true), TypeError);
  assert.equal(db.activeClients, 0); assert.equal(db.activeTransactions, 0);
  console.log('PASS: schema/read failures, lock-free snapshots, commit BEGIN/lock/write failures, rollback failures, pool errors, and idempotent release.');
} finally { db.restore(); }
