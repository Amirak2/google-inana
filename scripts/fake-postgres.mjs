import pg from 'pg';

// In-memory PostgreSQL protocol fixture, including transaction lock contention.
// Never connects to or mutates the live database.
export function installFakePostgres() {
  const oldConnect = pg.Pool.prototype.connect;
  const oldQuery = pg.Pool.prototype.query;
  let records = new Map();
  const events = [];
  const locks = new Map();
  let activeClients = 0;
  let activeTransactions = 0;
  const failures = [];
  const excluded = new Set(['orders','idempotency','media','logs','quotes','users','favorites','sessions','otp','phoneOtp','revoked','rateLimits']);
  function rows(sql, source, params = []) {
    const allowedBuckets = sql.includes('bucket = ANY') ? new Set(params[0]) : null;
    const requested = sql.includes('jsonb_to_recordset') ? new Set(JSON.parse(params[0]).map(row => JSON.stringify([row.bucket, row.record_key]))) : null;
    return [...source.values()].filter(row => (!allowedBuckets || allowedBuckets.has(row.bucket)) && (!requested || requested.has(JSON.stringify([row.bucket,row.record_key]))) && (!sql.includes('WHERE bucket NOT IN') || !excluded.has(row.bucket))).map(row => structuredClone(row));
  }
  function maybeFail(sql) {
    if (failures[0] && sql.includes(failures[0].match)) throw failures.shift().error;
  }
  pg.Pool.prototype.query = async (sql, params = []) => {
    events.push(sql); maybeFail(sql);
    return { rows: rows(sql, records, params) };
  };
  pg.Pool.prototype.connect = async () => {
    maybeFail('CONNECT');
    activeClients++;
    let open = false, released = false, unlock = null, draft = null;
    return {
      async query(sql, params = []) {
        events.push(sql); maybeFail(sql);
        if (sql === 'BEGIN') { open = true; activeTransactions++; }
        if (sql.includes('pg_advisory_xact_lock')) {
          const previous = locks.get(params[0]) || Promise.resolve();
          let finish;
          const next = new Promise(resolve => { finish = resolve; });
          locks.set(params[0], previous.then(() => next));
          await previous;
          unlock = finish;
          draft = structuredClone(records);
        }
        if (sql.startsWith('SELECT bucket')) return { rows: rows(sql, draft || records, params) };
        if (sql.startsWith('INSERT INTO site_records')) {
          draft.set(JSON.stringify(params.slice(0, 2)), { bucket: params[0], record_key: params[1], value_json: JSON.parse(params[2]) });
        }
        if (sql.startsWith('DELETE FROM site_records')) draft.delete(JSON.stringify(params));
        if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          if (sql === 'COMMIT' && draft) records = draft;
          if (open) { activeTransactions--; open = false; }
          unlock?.(); unlock = null;
        }
        return { rows: [] };
      },
      release(discard) {
        if (released) return;
        events.push(`RELEASE:${discard}`);
        released = true; activeClients--;
        if (open) { activeTransactions--; open = false; }
        unlock?.();
      },
    };
  };
  return {
    events,
    get activeClients() { return activeClients; },
    get activeTransactions() { return activeTransactions; },
    get(bucket, key) { return structuredClone(records.get(JSON.stringify([bucket,key]))?.value_json); },
    set(bucket, key, value) { records.set(JSON.stringify([bucket,key]), { bucket, record_key: key, value_json: structuredClone(value) }); },
    failNext(match) { const error = new Error(`Injected failure: ${match}`); failures.push({ match, error }); return error; },
    restore() { pg.Pool.prototype.connect = oldConnect; pg.Pool.prototype.query = oldQuery; },
  };
}
