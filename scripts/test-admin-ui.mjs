import assert from 'node:assert/strict';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { INITIAL_PRODUCTS, INITIAL_COLLECTIONS } from '../src/data/seedData.ts';
import { DEFAULT_SETTINGS } from '../src/utils/pricingEngine.ts';

const {build}=await import(process.platform==='win32'?'esbuild-wasm':'esbuild');
const output=new URL('../node_modules/.cache/admin-ui.mjs',import.meta.url);
await mkdir(new URL('./',output),{recursive:true});
const bundle=await build({
  stdin:{contents:`import React from 'react'; import {GoldStoreProvider,useGoldStore} from './src/context/GoldStoreContext'; import {AdminDashboard} from './src/components/AdminDashboard'; function Probe(){globalThis.adminHarness=useGoldStore();return <AdminDashboard/>;} export function Harness(){return <GoldStoreProvider><Probe/></GoldStoreProvider>;}`,loader:'tsx',resolveDir:process.cwd()},
  bundle:true,platform:'node',format:'esm',packages:'external',write:false,
  plugins:[{name:'admin-auth-fixture',setup(api){
    api.onResolve({filter:/AuthContext$/},()=>({path:'auth',namespace:'fixture'}));
    api.onResolve({filter:/SystemLogsViewer$/},()=>({path:'logs',namespace:'fixture'}));
    api.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'tsx',resolveDir:process.cwd(),contents:path==='auth'
      ?`export function useAuth(){return {currentUser:{uid:'admin-fixture',email:'admin@local.test'},userProfile:{role:'admin'},isAdmin:true,loading:false,openAuthModal(){},logout(){}};}`
      :`export function SystemLogsViewer(){return null;}`}));
  }}],
});
await writeFile(output,bundle.outputFiles[0].contents);
const dom=new JSDOM('<div id="app"></div>',{url:'https://local.test/admin'});
for(const name of ['window','document','localStorage','sessionStorage','HTMLElement','HTMLInputElement','HTMLSelectElement']) Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
window.scrollTo=()=>{};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let products=structuredClone(INITIAL_PRODUCTS.filter(p=>p.pricingMode!=='fixed').sort((a,b)=>Number(b.id==='inana-letter-f')-Number(a.id==='inana-letter-f')).slice(0,2));
products[0].stock=5; products[0].images=['https://local.test/first.webp','https://local.test/second.webp'];
let settings={...DEFAULT_SETTINGS,profitPercent:0,globalMakingChargePercent:0,bankCardNumber:'1111222233334444',bankName:'بانک تست'};
let gold={pricePerGram:23932462,isManualOverride:false,otherMarkets:{},changePercent:0};
const order={id:'review',trackingCode:'REVIEW',customerName:'مشتری تست',customerPhone:'09120000123',customerAddress:'نشانی تست',items:[],totalPrice:100,totalWeight:0,status:'در انتظار بررسی',createdAt:new Date().toISOString()};
let orders=[order,{...order,id:'rejected',trackingCode:'REJECTED',status:'رد شده'}];
let failPricing=true,failProducts=false,failOrders=false,failStatus=true,failSettings=false;
const mutations=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async (url,options={})=>{
  const method=options.method||'GET'; const body=options.body?JSON.parse(options.body):undefined;
  if(method!=='GET') mutations.push({url,method,body});
  if(url==='/api/user/favorites') return Response.json({favorites:[]});
  if(url==='/api/products') return Response.json(products);
  if(url==='/api/collections') return Response.json(INITIAL_COLLECTIONS);
  if(url==='/api/settings') return Response.json(settings);
  if(url==='/api/gold-price') return Response.json(gold);
  if(url==='/api/admin/settings') {if(failSettings)return Response.json({error:'خطای ذخیره تنظیمات آزمایشی'},{status:400});settings={...settings,...body};return Response.json({settings});}
  if(url==='/api/admin/gold-price') {gold={...gold,...body};return Response.json({goldPrice:gold});}
  if(url==='/api/orders'&&method==='GET') return failOrders?Response.json({error:'خطای دریافت سفارش آزمایشی'},{status:503}):Response.json(orders);
  if(url==='/api/orders'&&method==='DELETE') {const deletedIds=body.ids;orders=orders.filter(o=>!deletedIds.includes(o.id));return Response.json({deletedIds,deletedCount:deletedIds.length});}
  if(url.endsWith('/status')) {
    if(failStatus)return Response.json({error:'موجودی برای فعال‌سازی سفارش کافی نیست.'},{status:409});
    const id=url.split('/')[3];const updated={...orders.find(o=>o.id===id),status:body.status,reviewedAt:'2026-10-02T10:00:00Z',updatedAt:'2026-10-02T10:00:00Z',paymentReviewRequired:false};
    orders=orders.map(o=>o.id===id?updated:o);return Response.json({order:updated});
  }
  if(url.endsWith('/pricing')) {
    if(failPricing)return Response.json({error:'خطای ذخیره قیمت آزمایشی'},{status:400});
    const id=url.split('/')[4]; products=products.map(p=>p.id===id?{...p,...body}:p);return Response.json({product:products.find(p=>p.id===id)});
  }
  if(url==='/api/admin/products'&&method==='POST') {if(failProducts)return Response.json({error:'خطای ثبت محصول آزمایشی'},{status:400});return Response.json(body,{status:201});}
  if(url.startsWith('/api/admin/products/')&&method==='PUT') {
    if(failProducts)return Response.json({error:'خطای ویرایش محصول آزمایشی'},{status:409});
    const id=url.split('/')[4];products=products.map(p=>p.id===id?{...p,...body}:p);return Response.json(products.find(p=>p.id===id));
  }
  throw new Error(`Unexpected fixture request: ${method} ${url}`);
};
const React=await import('react');const {act}=React;const {createRoot}=await import('react-dom/client');const {Harness}=await import(output.href);
const root=createRoot(document.getElementById('app'));
const settle=()=>new Promise(resolve=>setTimeout(resolve,35));
async function update(fn){await act(async()=>{await fn();await settle();});}
const buttons=()=>[...document.querySelectorAll('button')];
const button=text=>buttons().find(b=>b.textContent.trim()===text||b.textContent.trim().includes(text));
async function click(node){assert.ok(node,'Expected button');await update(()=>node.click());}
async function input(node,value){assert.ok(node,'Expected input');await update(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(node,String(value));node.dispatchEvent(new window.Event('input',{bubbles:true}));});}
async function submit(form){assert.ok(form);await update(()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));}
const field=label=>document.querySelector(`input[type="number"][aria-label="${label}"]`);
try {
  await update(()=>root.render(React.createElement(Harness)));
  await input(field('اجرت اختصاصی'),12);
  products=products.map(p=>({...p,stock:4}));
  await update(()=>adminHarness.refreshProducts());
  assert.equal(field('اجرت اختصاصی').value,'12','Refreshing inventory must preserve pricing draft');
  await click(button('اعمال مستقیم اجرت'));
  assert.ok(document.body.textContent.includes('خطای ذخیره قیمت آزمایشی'));
  assert.equal(button('اعمال مستقیم اجرت').disabled,false,'Failed save releases button');
  assert.equal(field('اجرت اختصاصی').value,'12');
  failPricing=false;await click(button('اعمال مستقیم اجرت'));
  assert.equal(products[0].customMakingChargePercent,12);

  await click(button('مدیریت کل محصولات'));
  await click(document.querySelector('button[title="ویرایش کامل مشخصات"]'));
  await input(document.querySelector('input[aria-label="عنوان محصول"]'),'عنوان تازه از پنل');
  const firstImage=document.querySelector('input[aria-label="آدرس تصویر ۱"]');
  await input(firstImage,'https://local.test/new.webp');
  assert.equal(document.querySelector('input[aria-label="آدرس تصویر ۲"]').value,'https://local.test/second.webp');
  products[0].stock=3;await update(()=>adminHarness.refreshProducts());
  failProducts=true;await submit(document.querySelector('form'));
  assert.ok(document.body.textContent.includes('خطای ویرایش محصول آزمایشی'));
  assert.equal(document.querySelector('input[aria-label="عنوان محصول"]').value,'عنوان تازه از پنل');
  assert.equal(button('بروزرسانی کامل محصول').disabled,false);
  const patch=mutations.findLast(m=>m.method==='PUT'&&m.url.includes('/products/')).body;
  assert.equal(patch.stock,undefined,'Untouched stale stock is not sent');
  assert.equal(patch.images.length,2);
  failProducts=false;await submit(document.querySelector('form'));
  assert.equal(products[0].stock,3);
  await input(document.querySelector('input[aria-label="عنوان محصول"]'),'محصول با اجرت صفر');
  await input(field('اجرت محصول'),0);
  await submit(document.querySelector('form'));
  assert.equal(mutations.findLast(m=>m.method==='POST'&&m.url==='/api/admin/products').body.customMakingChargePercent,0);

  await click(button('نرخ پایه و فرمول'));
  assert.equal(field('نرخ دستی طلا').value,'23932462','Fetched rate initializes the form');
  assert.equal(field('سود عمومی').value,'0');
  assert.equal(field('اجرت عمومی').value,'0');
  await input(document.querySelector('input[aria-label="شماره کارت بانکی"]'),'2222333344445555');
  settings={...settings,profitPercent:4};await update(()=>adminHarness.refreshProducts());
  assert.equal(document.querySelector('input[aria-label="شماره کارت بانکی"]').value,'2222333344445555','Refresh preserves bank draft');
  assert.equal(field('سود عمومی').value,'4','Pristine settings follow fresh data');
  const rateWrites=mutations.filter(m=>m.url==='/api/admin/gold-price').length;
  failSettings=true;await submit(document.querySelector('form'));
  assert.ok(document.body.textContent.includes('خطای ذخیره تنظیمات آزمایشی'));
  assert.equal(button('ذخیره تنظیمات مالی و بانکی').disabled,false);
  failSettings=false;await submit(document.querySelector('form'));
  assert.equal(mutations.filter(m=>m.url==='/api/admin/gold-price').length,rateWrites,'Bank save must not write rate');
  assert.equal(gold.isManualOverride,false);
  await input(field('نرخ دستی طلا'),25000000);await click(button('ذخیره نرخ دستی طلا'));
  assert.equal(gold.pricePerGram,25000000);

  await click(button('سفارش‌ها'));
  const row=()=>document.querySelector('[data-order-id="review"]');
  assert.ok(row());
  await click([...row().querySelectorAll('button')].find(b=>b.textContent.includes('تأیید فیش')));
  assert.ok(row().textContent.includes('موجودی برای فعال‌سازی سفارش کافی نیست.'));
  assert.equal([...row().querySelectorAll('button')].find(b=>b.textContent.includes('تأیید فیش')).disabled,false);
  failStatus=false;await click([...row().querySelectorAll('button')].find(b=>b.textContent.includes('تأیید فیش')));
  assert.equal(row().querySelector('select').value,'تأیید شده','Server order becomes the current row');
  const options=[...row().querySelectorAll('option')].map(o=>o.value);
  assert.ok(options.includes('در حال آماده‌سازی')&&options.includes('آماده تحویل')&&options.includes('ارسال شد'));
  assert.ok(!options.includes('تأیید شد و در حال ساخت'));
  let confirmed=0;window.confirm=()=>{confirmed++;return false;};
  const deletes=()=>mutations.filter(m=>m.method==='DELETE').length;
  await click(button('پاکسازی رد شده‌ها'));assert.equal(confirmed,1);assert.equal(deletes(),0);
  window.confirm=()=>true;await click(button('پاکسازی رد شده‌ها'));
  assert.equal(mutations.findLast(m=>m.method==='DELETE').body.expectedStatus,'رد شده');
  failOrders=true;await click(button('بروزرسانی زنده لیست'));
  assert.ok(document.body.textContent.includes('خطای دریافت سفارش آزمایشی'));
  assert.ok(row(),'Stale list remains available after refresh failure');
  console.log('PASS: real admin React/provider failure recovery, dirty drafts, zero fees, delta product edits, gallery preservation, independent settings/rate save, server order feedback and confirmed cleanup.');
} finally {
  await act(async()=>root.unmount());globalThis.fetch=originalFetch;dom.window.close();await unlink(output);
}
