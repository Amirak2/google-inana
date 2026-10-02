import assert from 'node:assert/strict';
import { installFakePostgres } from './fake-postgres.mjs';
import { PostgresStore } from '../server/postgresStorage.ts';
import { runPostgresRequest } from '../server/postgresRequest.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';

process.env.PG_URI = 'postgresql://unused/archive-test';
const db = installFakePostgres();
const env = {SESSION_SECRET:'isolated-order-archive-secret-longer-than-32', NODE_ENV:'test'};
const deps = {externalize: async () => new Map(), migrate: async () => {}};
const seed = await PostgresStore.load(true);
seed.set('market','gold',{pricePerGram:23932462,isManualOverride:true});
createApp(seed,env);
const auth = createAuthStore(seed,env);
const admin = [...seed.map('users').values()].find(user=>user.role==='admin');
const customer = {uid:'archive-customer',email:'archive@local.test',phoneNumber:'09120000001',role:'customer'};
seed.set('users',customer.email,customer);
const adminToken = auth.createSessionToken(admin), customerToken = auth.createSessionToken(customer);
const product = [...seed.map('products').values()][0];
product.stock = 3;
const base = {userId:customer.uid,items:[{productId:product.id,quantity:1}],paymentReceiptImage:'/private/receipt.png',totalPrice:12345,createdAt:new Date().toISOString()};
for (const [id,status] of [['finished','تکمیل شده'],['rejected','رد شده'],['cancelled','لغو شده'],['pending','در انتظار بررسی']]) {
  seed.set('orders',id,{...base,id,trackingCode:`TRACK-${id.toUpperCase()}`,status,inventoryReleased:['رد شده','لغو شده'].includes(status)});
}
await seed.commit(); await seed.release();

async function request(path,method='GET',body,token=adminToken) {
  const req = new Request(`http://localhost${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const response = await runPostgresRequest(method,path,env,(store,requestEnv)=>createApp(store,requestEnv).fetch(req.clone(),{clientIp:'198.51.100.42'}),deps);
  return {status:response.status,body:await response.json()};
}
const single='/api/admin/orders/finished/archive', bulk='/api/admin/orders/archive';
assert.equal((await request(single,'PATCH',{archived:true},'')).status,401);
assert.equal((await request(single,'PATCH',{archived:true},customerToken)).status,403);
for (const body of [{archived:'true'},{},{archived:true,ids:[]},{archived:true,ids:Array(101).fill('finished')},{archived:true,ids:['finished'],expectedStatus:'در انتظار بررسی'}]) {
  assert.equal((await request(bulk,'POST',body)).status,400);
}
assert.equal((await request('/api/admin/orders/pending/archive','PATCH',{archived:true})).status,409);
assert.equal((await request('/api/admin/orders/missing/archive','PATCH',{archived:true})).status,404);
assert.equal((await request(bulk,'POST',{archived:true,ids:['rejected','pending']})).status,409);
assert.equal(db.get('orders','rejected').archivedAt,undefined,'No partial archive after mixed statuses');
assert.equal((await request(bulk,'POST',{archived:true,ids:['rejected','cancelled'],expectedStatus:'رد شده'})).status,409);
assert.equal(db.get('orders','rejected').archivedAt,undefined,'Stale status rejects entire batch');

for (const id of ['finished','rejected','cancelled']) {
  const before = structuredClone(db.get('orders',id));
  const archived = await request(`/api/admin/orders/${id}/archive`,'PATCH',{archived:true});
  assert.equal(archived.status,200); assert.ok(archived.body.order.archivedAt);
  assert.equal(db.get('orders',id).archivedAt,archived.body.order.archivedAt,'Archive survives new PostgreSQL snapshots');
  const repeat=await request(`/api/admin/orders/${id}/archive`,'PATCH',{archived:true});
  assert.equal(repeat.body.order.archivedAt,archived.body.order.archivedAt,'Retry is idempotent');
  assert.equal(repeat.body.order.updatedAt,archived.body.order.updatedAt);
  assert.equal(db.get('products',product.id).stock,3,'Archive never changes stock');
  assert.equal(repeat.body.order.status,before.status);
  assert.equal(repeat.body.order.inventoryReleased,before.inventoryReleased);
  assert.equal(repeat.body.order.paymentReceiptImage,base.paymentReceiptImage);
  const tracked=await request(`/api/orders/track/TRACK-${id.toUpperCase()}`,'GET',undefined,'');
  assert.equal(tracked.status,200); assert.equal(tracked.body.status,before.status);
  assert.equal((await request(`/api/orders/${id}/status`,'PATCH',{status:'لغو شده'})).status,409,'Restore before editing archived order');
  const restored=await request(`/api/admin/orders/${id}/archive`,'PATCH',{archived:false});
  assert.equal(restored.status,200);assert.equal(restored.body.order.archivedAt,undefined);
  assert.equal(db.get('products',product.id).stock,3,'Restoring never changes stock');
  assert.equal(restored.body.order.inventoryReleased,before.inventoryReleased);
}
const batch=await request(bulk,'POST',{archived:true,ids:['finished','rejected','rejected']});
assert.equal(batch.status,200); assert.equal(batch.body.orders.length,2);
const own=await request('/api/orders','GET',undefined,customerToken);
assert.equal(own.status,200);assert.equal(own.body.length,4,'Customer history includes archived orders');
assert.ok(own.body.find(o=>o.id==='finished').archivedAt);
assert.equal((await request('/api/orders/finished','GET',undefined,customerToken)).body.order.paymentReceiptImage,base.paymentReceiptImage);
await request('/api/admin/orders/rejected/archive','PATCH',{archived:false});
assert.equal((await request('/api/orders','DELETE',{ids:['rejected'],expectedStatus:'رد شده',expectedArchived:true})).status,409,'Restored order cannot be deleted by stale archive cleanup');
assert.ok(db.get('orders','rejected'));
assert.equal(db.get('products',product.id).stock,3);
console.log('PASS: PostgreSQL archive/restore persistence, terminal-only validation, admin authorization, idempotency, atomic batches, retained customer history/receipts/tracking and unchanged stock.');
