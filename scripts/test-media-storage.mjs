import assert from 'node:assert/strict';
import { externalizeImages, replaceResponseImages, migrateInlineMedia } from '../server/mediaStorage.ts';

const data = 'data:image/png;base64,aGVsbG8=';
function storeOf(records) {
  const buckets = new Map(Object.entries(records).map(([k,v]) => [k, new Map(v)]));
  return {
    map(k) { if (!buckets.has(k)) buckets.set(k, new Map()); return buckets.get(k); },
    get(k,id) { return this.map(k).get(id); },
    set(k,id,v) { this.map(k).set(id,v); },
  };
}
const store = storeOf({products:[['p',{images:[data]}]], orders:[
  ['a',{userId:'a',paymentReceiptImage:data,items:[{productImage:data}]}],
  ['b',{userId:'b',paymentReceiptImage:data}],
]});
const uploads = [];
const replacements=await externalizeImages(store, async (...args) => uploads.push(args), true);
assert.equal(uploads.length,3);
assert.equal(store.get('orders','a').items[0].productImage,store.get('products','p').images[0]);
assert.notEqual(store.get('orders','a').paymentReceiptImage,store.get('orders','b').paymentReceiptImage);
for (const owner of ['a','b']) {
  const response=replaceResponseImages({order:{userId:owner,paymentReceiptImage:data}},replacements);
  assert.equal(response.order.paymentReceiptImage,store.get('orders',owner).paymentReceiptImage);
}
for (const owner of ['a','b']) {
  const url=store.get('orders',owner).paymentReceiptImage;
  assert.ok(url.startsWith('/api/receipts/'));
  const metadata=store.get('media',url.split('/').pop());
  assert.equal(metadata.owner,owner);
  assert.equal(metadata.public,false);
  assert.equal(metadata.data,undefined);
}
await externalizeImages(store, async () => { throw new Error('Unexpected retry upload'); }, true);
await assert.rejects(externalizeImages(storeOf({products:[['p',{images:[data]}]]}), async()=>{}, false),/required/);
const failed=storeOf({orders:[['x',{userId:'x',paymentReceiptImage:data}]]});
await assert.rejects(externalizeImages(failed,async()=>{throw new Error('S3 unavailable');},true),/S3 unavailable/);
assert.equal(failed.get('orders','x').paymentReceiptImage,data);
assert.equal(failed.map('media').size,0);
console.log('Media storage: owner isolation, public products, retry and failure checks passed');

for (const key of ['LIARA_ENDPOINT','LIARA_BUCKET_NAME','LIARA_ACCESS_KEY','LIARA_SECRET_KEY']) process.env[key]='test';
const legacy=storeOf({media:[['old',{owner:'a',public:false,contentType:'image/png',data:'aGVsbG8='}]]});
await assert.rejects(migrateInlineMedia(legacy,async()=>{throw new Error('offline');}),/offline/);
assert.equal(legacy.get('media','old').data,'aGVsbG8=');
await migrateInlineMedia(legacy,async(key,bytes)=>{
  assert.equal(key,'receipts/old.png');
  assert.equal(bytes.toString(),'hello');
});
assert.equal(legacy.get('media','old').data,undefined);
assert.equal(legacy.get('media','old').owner,'a');
assert.equal(legacy.get('media','old').public,false);
assert.equal(legacy.get('media','old').objectKey,'receipts/old.png');
console.log('Legacy migration preserves URL IDs and permissions, and retains data on upload failure');
