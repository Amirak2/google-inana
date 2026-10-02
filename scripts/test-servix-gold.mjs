import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { refreshServixGold } from '../server/goldScheduler.ts';
import { parseServixGold, SERVIX_GOLD_URL, GOLD_POLL_INTERVAL_MS } from '../server/servixGold.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';

process.env.PG_URI = 'postgresql://unused/servix-test';
const db = installFakePostgres();
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw new Error('Unmocked external request'); };
const env = { SERVIX_API_KEY: 'isolated-fake-servix-key', SESSION_SECRET: 'isolated-servix-session-secret-at-least-32', NODE_ENV: 'test' };
let now = Date.now(), calls = 0, failure = false, payload;
const row = () => ({ code: 'GOLD_18_RLS', quoteUnit: 'RLS', value: 258632276.66666666, businessTime: new Date(now).toISOString() });
const deps = { now: () => now, fetch: async (url, init) => {
  calls++;
  assert.equal(url, SERVIX_GOLD_URL);
  assert.equal(init.headers['X-API-Key'], env.SERVIX_API_KEY);
  assert.equal(init.redirect, 'error');
  if (calls === 1) {
    assert.equal(db.activeTransactions, 0, 'Network runs outside DB locks');
    assert.equal(db.activeClients, 0, 'Network holds no database connection');
  }
  if (failure) throw new Error('Test network failure');
  return Response.json(payload || row());
} };
const request = async (path, method = 'GET', body, token) => {
  const req = new Request('http://localhost' + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return runPostgresRequest(method, path, env, (store, requestEnv) => createApp(store, requestEnv).fetch(req.clone(), {clientIp:'198.51.100.1'}), {externalize:async()=>new Map(),migrate:async()=>{}});
};
try {
  const price = parseServixGold(row(), undefined, now);
  assert.equal(price.pricePerGram, 25863228);
  assert.equal(price.isManualOverride, false);
  assert.equal(price.timestamp, row().businessTime);
  for (const override of [{code:'USD_RLS'}, {quoteUnit:'USD'}, {value:''}, {value:null}, {value:NaN}, {value:0}, {value:-1}, {businessTime:'invalid'}, {businessTime:new Date(now+600000).toISOString()}]) {
    assert.throws(() => parseServixGold({...row(),...override}, price, now));
  }
  assert.throws(() => parseServixGold({...row(),businessTime:new Date(now-1).toISOString()},price,now));
  assert.equal(parseServixGold({...row(),businessTime:new Date(now-2*GOLD_POLL_INTERVAL_MS).toISOString()},undefined,now).status,'cached');

  const seed = await PostgresStore.load(true);
  seed.set('market', 'gold', { ...price, pricePerGram:23932462,isManualOverride:true,status:'manual',source:'manual' });
  createApp(seed,env);
  const admin = [...seed.map('users').values()].find(user=>user.role==='admin');
  const token = createAuthStore(seed,env).createSessionToken(admin);
  await seed.commit(); await seed.release();
  assert.equal(await refreshServixGold(env,deps),true);
  const first = await Promise.all(Array.from({length:20},()=>refreshServixGold(env,deps)));
  assert.equal(first.filter(Boolean).length,0);
  assert.equal(calls,1,'Twenty concurrent scheduler replicas make one request');
  assert.equal(db.get('market','gold').pricePerGram,25863228);
  assert.equal(db.get('market','gold').isManualOverride,false);
  for(let i=0;i<10;i++) assert.equal((await request(i%2?'/api/products':'/api/gold-price')).status,200);
  assert.equal(calls,1,'Public reads never poll the provider');
  assert.equal((await request('/api/admin/gold-price','POST',{pricePerGram:1,isManualOverride:true},token)).status,410);
  await request('/api/admin/gold-price/sync','POST',{},token);
  await request('/api/gold-price/refresh','POST',{},token);
  assert.equal(calls,1,'Admin requests cannot bypass the hourly claim');
  assert.equal(await refreshServixGold(env,deps),false,'New snapshots/restarts retain cooldown');
  now += GOLD_POLL_INTERVAL_MS-1;
  assert.equal(await refreshServixGold(env,deps),false);
  now++;
  failure = true;
  assert.equal(await refreshServixGold(env,deps),false);
  assert.equal(calls,2);
  assert.equal(db.get('market','gold').pricePerGram,25863228,'Network failure preserves price');
  assert.equal(db.get('market','gold').status,'cached');
  await refreshServixGold(env,deps);
  assert.equal(calls,2,'Failure does not cause request storms');
  now += GOLD_POLL_INTERVAL_MS;
  failure = false; payload = {...row(),code:'USD_RLS'};
  await refreshServixGold(env,deps);
  assert.equal(db.get('market','gold').pricePerGram,25863228,'Wrong symbol cannot change price');
  now += GOLD_POLL_INTERVAL_MS;
  payload = {...row(),value:260000000};
  const boundary = await Promise.all(Array.from({length:20},()=>refreshServixGold(env,deps)));
  assert.equal(boundary.filter(Boolean).length,1,'Exactly one replica owns the next hourly refresh');
  assert.equal(calls,4,'Concurrent replicas do not duplicate provider calls');
  assert.equal(db.get('market','gold').pricePerGram,26000000);
  assert.equal(db.get('market','gold').timestamp,payload.businessTime);
  const history = db.get('market','hourlyHistory');
  assert.equal(history.length,2,'Only real accepted observations enter history');
  assert.ok(history.every(point=>point.isEstimated===false));
  assert.equal(db.activeClients,0); assert.equal(db.activeTransactions,0);
  assert.ok(!JSON.stringify(db.get('market','gold')).includes(env.SERVIX_API_KEY));
  console.log('PASS: Servix symbol/unit/time validation, rial-to-toman conversion, 20 concurrent hourly claims, restart cooldown, network isolation, failure retention, real history and retired manual/admin bypass paths.');
} finally { globalThis.fetch=originalFetch; db.restore(); }
