import assert from 'node:assert/strict';
import { Store } from '../server/storage.ts';
import { createApp } from '../server.ts';
import { createAuthStore } from '../server/authStore.ts';

const env = { SESSION_SECRET: 'isolated-order-deletion-secret-longer-than-32', NODE_ENV: 'test' };
for (const mode of ['single', 'admin-single', 'bulk', 'clear']) {
  for (const status of ['در انتظار بررسی', 'تکمیل شده', 'لغو شده', 'رد شده']) {
    const store = new Store(env);
    store.set('market', 'gold', { pricePerGram: 23932462, isManualOverride: true });
    createApp(store, env);
    const product = [...store.map('products').values()][0];
    product.stock = 2;
    store.set('orders', 'sale-one', { id: 'sale-one', trackingCode: 'SALE01', status, inventoryReleased: ['لغو شده', 'رد شده'].includes(status), items: [{ productId: product.id, quantity: 1 }], createdAt: new Date().toISOString() });
    const app = createApp(store, env);
    const auth = createAuthStore(store, env);
    const token = auth.createSessionToken([...store.map('users').values()].find(user => user.role === 'admin'));
    const path = mode === 'single' ? '/api/orders/sale-one' : mode === 'admin-single' ? '/api/admin/orders/sale-one' : '/api/orders';
    const body = mode === 'bulk' ? { ids: ['sale-one'] } : mode === 'clear' ? { clearAll: true } : undefined;
    const response = await app.fetch(new Request(`http://localhost${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));
    assert.equal(response.status, 200, `${mode}/${status}`);
    assert.equal(store.get('products', product.id).stock, 2, `${mode}/${status}: deletion must not restock`);
    assert.equal(store.get('orders', 'sale-one'), undefined);
  }
}
console.log('PASS: single/admin/bulk/clear deletion never restocks completed, pending, cancelled or rejected orders.');
