import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';
import { ORDER_STATUSES, orderStatusOptions } from '../src/utils/orderWorkflow.ts';
import { changedProductFields } from '../src/utils/adminProductForm.ts';

const env = { SESSION_SECRET:'isolated-admin-test-secret-longer-than-32', NODE_ENV:'test' };
const store = new Store(env);
store.set('market','gold',{pricePerGram:23932462,isManualOverride:false});
createApp(store,env);
const admin = [...store.map('users').values()].find(user=>user.role==='admin');
const token = createAuthStore(store,env).createSessionToken(admin);
async function request(path, method, body) {
  const response = await createApp(store,env).fetch(new Request(`http://localhost${path}`,{
    method, headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),
  }));
  return {status:response.status,body:await response.json()};
}
const product = [...store.map('products').values()][0];
product.stock=5;
store.set('products',product.id,product);
const draft=structuredClone(product);
draft.title='عنوان تازه محصول';
product.stock=4; store.set('products',product.id,product);
const edit=await request(`/api/admin/products/${product.id}`,'PUT',changedProductFields({...draft,title:product.title},draft));
assert.equal(edit.status,200);
assert.equal(store.get('products',product.id).stock,4,'Editing title must not restore stale stock');
assert.equal((await request(`/api/admin/products/${product.id}`,'PUT',{stock:9,expectedStock:5})).status,409);
assert.equal((await request(`/api/admin/products/${product.id}`,'PUT',{stock:9})).status,409,'Stock changes need a comparison value');
assert.equal((await request(`/api/admin/products/${product.id}`,'PUT',{stock:9,expectedStock:4})).status,200);
assert.equal(store.get('products',product.id).stock,9);
assert.equal(store.get('products',product.id).expectedStock,undefined);

for(const target of ORDER_STATUSES) {
  const id=`workflow-${target}`;
  store.set('orders',id,{id,trackingCode:id,status:'در انتظار بررسی',items:[],createdAt:new Date().toISOString()});
  const result=await request(`/api/orders/${encodeURIComponent(id)}/status`,'PATCH',{status:target});
  assert.equal(result.status,200,`Shared status must work: ${target}`);
  assert.equal(result.body.order.status,target);
}
store.set('orders','finished',{id:'finished',trackingCode:'finished',status:'تکمیل شده',items:[],createdAt:new Date().toISOString()});
assert.equal((await request('/api/orders/finished/status','PATCH',{status:'تأیید شده'})).status,409);
assert.deepEqual(orderStatusOptions('تکمیل شده'),['تکمیل شده','لغو شده']);
store.set('orders','rejected',{id:'rejected',trackingCode:'rejected',status:'رد شده',items:[],createdAt:new Date().toISOString()});
store.set('orders','changed',{id:'changed',trackingCode:'changed',status:'تأیید شده',items:[],createdAt:new Date().toISOString()});
assert.equal((await request('/api/orders','DELETE',{ids:['rejected','changed'],expectedStatus:'رد شده'})).status,409);
assert.ok(store.get('orders','rejected'),'Mixed cleanup must fail atomically');
assert.ok(store.get('orders','changed'));
const cleared=await request('/api/orders','DELETE',{ids:['rejected'],expectedStatus:'رد شده'});
assert.equal(cleared.status,200); assert.deepEqual(cleared.body.deletedIds,['rejected']);

const before=structuredClone(store.get('market','gold'));
assert.equal((await request('/api/admin/settings','PUT',{bankName:'بانک آزمایشی',globalMakingChargePercent:0,profitPercent:0})).status,200);
assert.deepEqual(store.get('market','gold'),before,'Bank settings must not change gold mode or rate');
console.log('PASS: admin stale stock comparison, metadata-only edits, all workflow states, terminal-state guard and atomic rejected-only cleanup.');
