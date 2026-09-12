import type { Product, Order } from '../src/types';
import type { Store } from './storage';
export function createDb(store: Store) {
 const getAllProductsFromDb = (): Product[] => [...store.map<Product>('products').values()];
 const getProductByIdFromDb = (id: string): Product | null => store.get('products', id) || null;
 const saveProductToDb = (product: Product) => store.set('products', product.id, product);
 const saveAllProductsToDb = (products: Product[]) => products.forEach(saveProductToDb);
 const deleteProductFromDb = (id: string) => store.map('products').delete(id);
 const getAllOrdersFromDb = (): Order[] => [...store.map<Order>('orders').values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
 const getOrderByIdOrTrackingFromDb = (id: string): Order | null => store.get('orders', id) || getAllOrdersFromDb().find(o => o.trackingCode === id) || null;
 const saveOrderToDb = (order: Order) => {
  if (getAllOrdersFromDb().some(o => o.trackingCode === order.trackingCode && o.id !== order.id)) throw new Error('Duplicate tracking code');
  store.set('orders', order.id, order);
 };
 const deleteOrderFromDb = (id: string) => { const order = getOrderByIdOrTrackingFromDb(id); return order ? store.map('orders').delete(order.id) : false; };
 const deleteOrdersBulkFromDb = (ids: string[]) => ids.reduce((n,id) => n + Number(deleteOrderFromDb(id)), 0);
 const getIdempotentOrderFromDb = (userId: string, key: string): Order | null => store.get('idempotency', JSON.stringify([userId,key])) || null;
 const saveIdempotencyKeyToDb = (userId: string, key: string, _orderId: string, order: Order) => store.set('idempotency', JSON.stringify([userId,key]), order);
 const runDbTransaction = async <T>(action: () => T | Promise<T>): Promise<T> => {
  const snapshot = store.checkpoint();
  try { return await action(); } catch (error) { store.restore(snapshot); throw error; }
 };
 const seedDatabaseIfEmpty = (products: Product[], _orders: Order[]) => {
  if (store.get('migrations', 'initialProducts')) return;
  if (!store.map('products').size) products.forEach(p => saveProductToDb(structuredClone(p)));
  store.set('migrations', 'initialProducts', true);
 };
 return { getAllProductsFromDb, getProductByIdFromDb, saveProductToDb, saveAllProductsToDb, deleteProductFromDb, getAllOrdersFromDb, getOrderByIdOrTrackingFromDb, saveOrderToDb, deleteOrderFromDb, deleteOrdersBulkFromDb, getIdempotentOrderFromDb, saveIdempotencyKeyToDb, runDbTransaction, seedDatabaseIfEmpty };
}
